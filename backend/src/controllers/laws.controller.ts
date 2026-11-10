import { checkRateLimit } from '../middleware/rate-limit.ts';
import { getVoterIdentifier, readBody, sendJson, badRequest, rateLimitExceeded, notFound, PayloadTooLargeError } from '../utils/http-helpers.ts';
import { BodyError, parseCorollaryList } from '../utils/corollary-input.ts';

// Room for the law, up to five corollaries with titles, and the contact fields, as UTF-8 text. A client that escapes
// every non-ASCII character as \\uXXXX can send the same content in about three times the bytes and gets a 413.
const MAX_SUBMIT_BODY_BYTES = 32 * 1024;

function parseBoundedInt(value: unknown, { min, max, fallback }: { min: number; max: number; fallback: number }) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export class LawController {
  lawService: any;
  emailService: any;

  constructor(lawService: any, emailService: any) {
    this.lawService = lawService;
    this.emailService = emailService;
  }

  async list(req: any, res: any, parsed: any) {
    const query = parsed.query;
    const limit = parseBoundedInt(query.limit, { min: 1, max: 25, fallback: 25 });
    const offset = parseBoundedInt(query.offset, { min: 0, max: Number.MAX_SAFE_INTEGER, fallback: 0 });
    const q = (query.q || '').toString().trim();
    const categorySlug = query.category_slug ? query.category_slug.toString().trim() : null;
    const attribution = (query.attribution || '').toString().trim();

    const parsedCategoryId = Number(query.category_id);
    const categoryId = Number.isFinite(parsedCategoryId) && parsedCategoryId > 0
      ? Math.trunc(parsedCategoryId)
      : null;

    // Sorting parameters with validation
    const allowedSortFields = ['relevance', 'score', 'upvotes', 'created_at', 'last_voted_at'];
    const sortCandidate = typeof query.sort === 'string' ? query.sort : '';
    const sort = allowedSortFields.includes(sortCandidate) ? sortCandidate : (q ? 'relevance' : 'score');
    const order = query.order === 'asc' ? 'asc' : 'desc';

    const excludeCorollaries = query.exclude_corollaries === '1' || query.exclude_corollaries === 'true';

    const result = await this.lawService.listLaws({ limit, offset, q, categoryId, categorySlug, attribution, sort, order, excludeCorollaries });
    
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

  async get(req: any, res: any, id: number) {
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

  async getRelated(req: any, res: any, id: number) {
    const lawId = Number(id);
    if (!Number.isInteger(lawId) || lawId <= 0) {
      return badRequest(res, 'Invalid law ID', req);
    }

    // Verify the law exists before fetching related laws
    const law = await this.lawService.getLaw(lawId);
    if (!law) {
      return notFound(res, req);
    }

    // Parse query parameters from URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limitParam = url.searchParams.get('limit');
    const limitNum = limitParam ? Number(limitParam) : 5;
    if (!Number.isInteger(limitNum)) {
      return badRequest(res, 'Limit must be an integer', req);
    }
    const limit = Math.max(1, Math.min(10, limitNum));

    const relatedLaws = await this.lawService.getRelatedLaws(lawId, { limit });

    return sendJson(res, 200, { data: relatedLaws, law_id: lawId }, req);
  }

  async getRandom(req: any, res: any) {
    const law = await this.lawService.getRandomLaw();
    if (!law) {
      return sendJson(res, 404, { error: 'No published laws available' }, req);
    }
    return sendJson(res, 200, law, req);
  }

  async getLawOfTheDay(req: any, res: any) {
    const result = await this.lawService.getLawOfTheDay();
    if (!result) {
      return sendJson(res, 404, { error: 'No published laws available' }, req);
    }
    return sendJson(res, 200, result, req);
  }

  async suggestions(req: any, res: any, parsed: any) {
    const q = (parsed.query.q || '').toString().trim();
    
    // Validate query parameter
    if (!q || q.length < 2) {
      return badRequest(res, 'Query parameter "q" is required and must be at least 2 characters', req);
    }

    // Validate and limit limit parameter
    const limit = parseBoundedInt(parsed.query.limit, { min: 1, max: 20, fallback: 10 });

    const result = await this.lawService.suggestions({ q, limit });
    
    return sendJson(res, 200, result, req);
  }

  async duplicates(req: any, res: any, parsed: any) {
    const text = (parsed.query.text || '').toString().trim();
    const limit = parseBoundedInt(parsed.query.limit, { min: 1, max: 10, fallback: 5 });

    if (!text || text.length < 10) {
      return badRequest(res, 'Query parameter "text" is required and must be at least 10 characters', req);
    }

    const result = await this.lawService.findDuplicateCandidates({ text, limit });
    return sendJson(res, 200, { data: result, text, limit }, req);
  }

  async submit(req: any, res: any) {
    const identifier = getVoterIdentifier(req);
    const rateLimit = checkRateLimit(identifier, 'submit');

    if (!rateLimit.allowed) {
      return rateLimitExceeded(res, rateLimit, req);
    }

    let body: any;
    try {
      body = await readBody(req, MAX_SUBMIT_BODY_BYTES);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return sendJson(res, 413, { error: 'Your submission is too large. Shorten the law or its corollaries and try again.' }, req);
      }
      return badRequest(res, 'Invalid JSON body', req);
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return badRequest(res, 'Body must be a JSON object', req);
    }

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
      categoryId = parseInt(body.category_id, 10);
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

    let corollaries: { title: string | null; text: string }[] = [];
    if (body.corollaries !== undefined && body.corollaries !== null) {
      try {
        corollaries = parseCorollaryList(body.corollaries, text, 0);
      } catch (error) {
        if (error instanceof BodyError) {
          return badRequest(res, error.message, req);
        }
        throw error;
      }
    }

    try {
      const submitted = await this.lawService.submitLaw({ title, text, author, email, categoryId, corollaries });

      // Send email notification (async, don't wait for it)
      this.emailService.sendNewLawEmail({
        id: submitted.id,
        title,
        text,
        author,
        email,
        corollaries: submitted.corollaries
      }).catch((err: any) => console.error('Email notification failed:', err));

      return sendJson(res, 201, {
        id: submitted.id,
        title,
        text,
        status: 'in_review',
        corollaries: submitted.corollaries,
        message: 'Law submitted successfully and is pending review'
      }, req, rateLimit);
    } catch (error: any) {
      console.error('Submission error:', error);
      return badRequest(res, error.message, req);
    }
  }
}
