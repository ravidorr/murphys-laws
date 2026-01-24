import { checkRateLimit } from '../middleware/rate-limit.mjs';
import { getVoterIdentifier, readBody, sendJson, badRequest, rateLimitExceeded, notFound } from '../utils/http-helpers.js';

export class LawController {
  constructor(lawService, emailService) {
    this.lawService = lawService;
    this.emailService = emailService;
  }

  async list(req, res, parsed) {
    const limit = Math.max(1, Math.min(25, Number(parsed.query.limit || 25))); // Hardcoded constants for now, should import
    const offset = Math.max(0, Number(parsed.query.offset || 0));
    const q = (parsed.query.q || '').toString().trim();
    const categoryId = parsed.query.category_id ? Number(parsed.query.category_id) : null;
    const categorySlug = parsed.query.category_slug ? parsed.query.category_slug.toString().trim() : null;
    const attribution = (parsed.query.attribution || '').toString().trim();
    
    // Sorting parameters with validation
    const allowedSortFields = ['score', 'upvotes', 'created_at', 'last_voted_at'];
    const sort = allowedSortFields.includes(parsed.query.sort) ? parsed.query.sort : 'score';
    const order = parsed.query.order === 'asc' ? 'asc' : 'desc';

    const result = await this.lawService.listLaws({ limit, offset, q, categoryId, categorySlug, attribution, sort, order });
    
    return sendJson(res, 200, { 
      data: result.data, 
      limit, 
      offset, 
      total: result.total, 
      q, 
      category_id: categoryId,
      category_slug: categorySlug,
      attribution,
      sort,
      order
    }, req);
  }

  async get(req, res, id) {
    const lawId = Number(id);
    if (!Number.isInteger(lawId) || lawId <= 0) {
      return badRequest(res, 'Invalid law ID', req);
    }

    const law = await this.lawService.getLaw(lawId);
    if (!law) {
      return notFound(res, req);
    }

    return sendJson(res, 200, law, req);
  }

  async getRelated(req, res, id) {
    const lawId = Number(id);
    if (!Number.isInteger(lawId) || lawId <= 0) {
      return badRequest(res, 'Invalid law ID', req);
    }

    // Parse query parameters from URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limitParam = url.searchParams.get('limit');
    const limitNum = limitParam ? Number(limitParam) : 5;
    const limit = Number.isNaN(limitNum) ? 5 : Math.max(1, Math.min(10, limitNum));

    const relatedLaws = await this.lawService.getRelatedLaws(lawId, { limit });

    return sendJson(res, 200, { data: relatedLaws, law_id: lawId }, req);
  }

  async getLawOfTheDay(req, res) {
    const result = await this.lawService.getLawOfTheDay();
    if (!result) {
      return sendJson(res, 404, { error: 'No published laws available' }, req);
    }
    return sendJson(res, 200, result, req);
  }

  async suggestions(req, res, parsed) {
    const q = (parsed.query.q || '').toString().trim();
    
    // Validate query parameter
    if (!q || q.length < 2) {
      return badRequest(res, 'Query parameter "q" is required and must be at least 2 characters', req);
    }

    // Validate and limit limit parameter
    const limit = Math.max(1, Math.min(20, Number(parsed.query.limit || 10)));

    const result = await this.lawService.suggestions({ q, limit });
    
    return sendJson(res, 200, result, req);
  }

  async submit(req, res) {
    const identifier = getVoterIdentifier(req);
    const rateLimit = checkRateLimit(identifier, 'submit');

    if (!rateLimit.allowed) {
      return rateLimitExceeded(res, rateLimit.resetTime, req);
    }

    const body = await readBody(req);

    // Validate required fields
    if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
      return badRequest(res, 'Law text is required', req);
    }

    const text = body.text.trim();
    const title = body.title && typeof body.title === 'string' ? body.title.trim() : null;
    const author = body.author && typeof body.author === 'string' ? body.author.trim() : null;
    const email = body.email && typeof body.email === 'string' ? body.email.trim() : null;
    
    let categoryId = null;
    if (body.category_id) {
      categoryId = parseInt(body.category_id);
      if (Number.isNaN(categoryId) || categoryId <= 0) {
        return badRequest(res, 'Invalid category ID', req);
      }
    }

    // Validate text length
    if (text.length < 10) {
      return badRequest(res, 'Law text must be at least 10 characters', req);
    }

    if (text.length > 1000) {
      return badRequest(res, 'Law text must be less than 1000 characters', req);
    }

    try {
      const lawId = await this.lawService.submitLaw({ title, text, author, email, categoryId });

      // Send email notification (async, don't wait for it)
      this.emailService.sendNewLawEmail({
        id: lawId,
        title,
        text,
        author,
        email
      }).catch(err => console.error('Email notification failed:', err));

      return sendJson(res, 201, {
        id: lawId,
        title,
        text,
        status: 'in_review',
        message: 'Law submitted successfully and is pending review'
      }, req);
    } catch (error) {
      console.error('Submission error:', error);
      return badRequest(res, error.message, req);
    }
  }
}
