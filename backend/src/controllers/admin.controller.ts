import { checkAdminAuth } from '../middleware/admin-auth.ts';
import { checkRateLimit } from '../middleware/rate-limit.ts';
import { ADMIN_LAW_STATUSES, type AdminLawStatus, type AdminLawUpdate } from '../services/admin-laws.service.ts';
import { getVoterIdentifier, readBody, sendJson, notFound, rateLimitExceeded } from '../utils/http-helpers.ts';

const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;
const NO_STORE = { 'Cache-Control': 'no-store' };

function isStatus(value: unknown): value is AdminLawStatus {
  return typeof value === 'string' && (ADMIN_LAW_STATUSES as readonly string[]).includes(value);
}

function parseBoundedInt(value: unknown, { min, max, fallback }: { min: number; max: number; fallback: number }) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

export class AdminController {
  adminLawService: any;

  constructor(adminLawService: any) {
    this.adminLawService = adminLawService;
  }

  private json(res: any, status: number, body: unknown, req: any) {
    return sendJson(res, status, body, req, null, NO_STORE);
  }

  private fail(res: any, status: number, message: string, req: any) {
    return this.json(res, status, { error: message }, req);
  }

  /**
   * Returns true when the request may proceed; otherwise the response has been sent.
   * Only failed logins are rate limited, so wrong-token traffic cannot lock out the real admin.
   */
  private authorize(req: any, res: any): boolean {
    const auth = checkAdminAuth(req);
    if (auth === 'disabled') {
      notFound(res, req);
      return false;
    }
    if (auth === 'unauthorized') {
      const identifier = getVoterIdentifier(req);
      console.warn(`Admin auth failed from ${identifier}`);
      const rateLimit = checkRateLimit(identifier, 'admin-fail');
      if (!rateLimit.allowed) {
        rateLimitExceeded(res, rateLimit, req);
      } else {
        this.fail(res, 401, 'Unauthorized', req);
      }
      return false;
    }
    return true;
  }

  async list(req: any, res: any, parsed: any) {
    if (!this.authorize(req, res)) return;

    const query = parsed.query;
    const statusParam = (query.status || 'in_review').toString();
    if (statusParam !== 'all' && !isStatus(statusParam)) {
      return this.fail(res, 400, 'Invalid status', req);
    }

    const limit = parseBoundedInt(query.limit, { min: 1, max: 100, fallback: 50 });
    const offset = parseBoundedInt(query.offset, { min: 0, max: Number.MAX_SAFE_INTEGER, fallback: 0 });
    const q = (query.q || '').toString().trim();

    const result = this.adminLawService.listLaws({ status: statusParam, q, limit, offset });
    return this.json(res, 200, { ...result, limit, offset, status: statusParam, q }, req);
  }

  async update(req: any, res: any, id: string) {
    if (!this.authorize(req, res)) return;

    const lawId = Number(id);
    if (!Number.isInteger(lawId) || lawId <= 0) {
      return this.fail(res, 400, 'Invalid law ID', req);
    }

    let body: any;
    try {
      body = await readBody(req);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return this.fail(res, 400, 'Invalid JSON body', req);
      }
      throw error;
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return this.fail(res, 400, 'Body must be a JSON object', req);
    }

    const update: AdminLawUpdate = {};

    if (body.status !== undefined) {
      if (!isStatus(body.status)) {
        return this.fail(res, 400, 'Invalid status', req);
      }
      update.status = body.status;
    }

    if (body.text !== undefined) {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (text.length < 10 || text.length > 1000) {
        return this.fail(res, 400, 'Law text must be between 10 and 1000 characters', req);
      }
      update.text = text;
    }

    if (body.title !== undefined) {
      if (body.title !== null && typeof body.title !== 'string') {
        return this.fail(res, 400, 'Title must be a string or null', req);
      }
      if (body.title && body.title.trim().length > MAX_TITLE_LENGTH) {
        return this.fail(res, 400, `Title must be at most ${MAX_TITLE_LENGTH} characters`, req);
      }
      update.title = body.title ? body.title.trim() || null : null;
    }

    if (body.admin_notes !== undefined) {
      if (body.admin_notes !== null && typeof body.admin_notes !== 'string') {
        return this.fail(res, 400, 'admin_notes must be a string or null', req);
      }
      if (body.admin_notes && body.admin_notes.trim().length > MAX_NOTES_LENGTH) {
        return this.fail(res, 400, `admin_notes must be at most ${MAX_NOTES_LENGTH} characters`, req);
      }
      update.adminNotes = body.admin_notes ? body.admin_notes.trim() || null : null;
    }

    if (Object.keys(update).length === 0) {
      return this.fail(res, 400, 'No updatable fields provided', req);
    }

    if (body.updated_at !== undefined) {
      if (typeof body.updated_at !== 'string') {
        return this.fail(res, 400, 'updated_at must be a string', req);
      }
      update.expectedUpdatedAt = body.updated_at;
    }

    const result = this.adminLawService.updateLaw(lawId, update);
    if (result.outcome === 'not_found') {
      return this.fail(res, 404, 'Law not found', req);
    }
    if (result.outcome === 'conflict') {
      return this.fail(res, 409, 'This law changed since you loaded it. Reload the list and try again.', req);
    }

    const { expectedUpdatedAt: _expected, ...applied } = update;
    console.log(`Admin updated law ${lawId} from ${getVoterIdentifier(req)}: ${JSON.stringify(applied)}`);
    return this.json(res, 200, { data: result.law }, req);
  }
}
