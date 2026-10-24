import { checkAdminAuth } from '../middleware/admin-auth.ts';
import { checkRateLimit } from '../middleware/rate-limit.ts';
import { ADMIN_LAW_STATUSES, type AdminLawStatus, type AdminLawUpdate } from '../services/admin-laws.service.ts';
import { getVoterIdentifier, readBody, sendJson, badRequest, notFound, rateLimitExceeded } from '../utils/http-helpers.ts';

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

  /** Returns true when the request may proceed; otherwise the response has been sent. */
  private authorize(req: any, res: any): boolean {
    const rateLimit = checkRateLimit(getVoterIdentifier(req), 'admin');
    if (!rateLimit.allowed) {
      rateLimitExceeded(res, rateLimit, req);
      return false;
    }

    const auth = checkAdminAuth(req);
    if (auth === 'disabled') {
      notFound(res, req);
      return false;
    }
    if (auth === 'unauthorized') {
      sendJson(res, 401, { error: 'Unauthorized' }, req);
      return false;
    }
    return true;
  }

  async list(req: any, res: any, parsed: any) {
    if (!this.authorize(req, res)) return;

    const query = parsed.query;
    const statusParam = (query.status || 'in_review').toString();
    if (statusParam !== 'all' && !isStatus(statusParam)) {
      return badRequest(res, 'Invalid status', req);
    }

    const limit = parseBoundedInt(query.limit, { min: 1, max: 100, fallback: 50 });
    const offset = parseBoundedInt(query.offset, { min: 0, max: Number.MAX_SAFE_INTEGER, fallback: 0 });
    const q = (query.q || '').toString().trim();

    const result = this.adminLawService.listLaws({ status: statusParam, q, limit, offset });
    return sendJson(res, 200, { ...result, limit, offset, status: statusParam, q }, req);
  }

  async update(req: any, res: any, id: string) {
    if (!this.authorize(req, res)) return;

    const lawId = Number(id);
    if (!Number.isInteger(lawId) || lawId <= 0) {
      return badRequest(res, 'Invalid law ID', req);
    }

    let body: any;
    try {
      body = await readBody(req);
    } catch {
      return badRequest(res, 'Invalid JSON body', req);
    }

    const update: AdminLawUpdate = {};

    if (body.status !== undefined) {
      if (!isStatus(body.status)) {
        return badRequest(res, 'Invalid status', req);
      }
      update.status = body.status;
    }

    if (body.text !== undefined) {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (text.length < 10 || text.length > 1000) {
        return badRequest(res, 'Law text must be between 10 and 1000 characters', req);
      }
      update.text = text;
    }

    if (body.title !== undefined) {
      if (body.title !== null && typeof body.title !== 'string') {
        return badRequest(res, 'Title must be a string or null', req);
      }
      update.title = body.title ? body.title.trim() || null : null;
    }

    if (body.admin_notes !== undefined) {
      if (body.admin_notes !== null && typeof body.admin_notes !== 'string') {
        return badRequest(res, 'admin_notes must be a string or null', req);
      }
      update.adminNotes = body.admin_notes ? body.admin_notes.trim() || null : null;
    }

    if (Object.keys(update).length === 0) {
      return badRequest(res, 'No updatable fields provided', req);
    }

    const law = this.adminLawService.updateLaw(lawId, update);
    if (!law) {
      return notFound(res, req);
    }
    return sendJson(res, 200, { data: law }, req);
  }
}
