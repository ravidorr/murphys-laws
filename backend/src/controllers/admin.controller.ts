import { getAdminAccess } from '../middleware/admin-auth.ts';
import { checkRateLimit } from '../middleware/rate-limit.ts';
import { ADMIN_LAW_STATUSES, type AdminLawStatus, type AdminLawUpdate } from '../services/admin-laws.service.ts';
import { getVoterIdentifier, readBody, sendJson, notFound, rateLimitExceeded, PayloadTooLargeError } from '../utils/http-helpers.ts';

const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;
const MAX_QUERY_LENGTH = 200;
const MAX_BODY_BYTES = 16 * 1024;
// One plain address: no whitespace, list separators, group or display-name syntax, quotes or brackets.
const EMAIL_PATTERN = /^[^\s@,;:<>()"\\[\]]+@[^\s@,;:<>()"\\[\]]+\.[^\s@,;:<>()"\\[\]]+$/;
const MAX_EMAIL_LENGTH = 254;
const NO_STORE = { 'Cache-Control': 'no-store' };

function isStatus(value: unknown): value is AdminLawStatus {
  return typeof value === 'string' && (ADMIN_LAW_STATUSES as readonly string[]).includes(value);
}

function parseBoundedInt(value: unknown, { min, max, fallback }: { min: number; max: number; fallback: number }) {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

export class AdminController {
  adminLawService: any;
  emailService: any;

  constructor(adminLawService: any, emailService: any) {
    this.adminLawService = adminLawService;
    this.emailService = emailService;
  }

  /**
   * Thanks the submitter when a law moves from review to published. Sending is fire and forget so a slow mail
   * server never delays moderation, and any problem here is contained so it cannot fail an update that is
   * already saved. `queued` means a send was started, not that the mail was delivered.
   * Returns null when the update was not an approval.
   */
  private thankSubmitter(result: any): { status: 'queued' } | { status: 'skipped'; reason: string } | null {
    try {
      const law = result.law;
      if (result.previousStatus !== 'in_review' || law.status !== 'published') {
        return null;
      }
      if (!this.emailService.isConfigured()) {
        return { status: 'skipped', reason: 'not_configured' };
      }
      if (law.approval_email_sent_at) {
        return { status: 'skipped', reason: 'already_sent' };
      }

      const contacts = (law.attributions as { name: string | null; contact_type: string | null; contact_value: string | null }[])
        .filter((a) => a.contact_type === 'email' && typeof a.contact_value === 'string');
      if (contacts.length === 0) {
        return { status: 'skipped', reason: 'no_email' };
      }
      const attribution = contacts.find((a) => (a.contact_value as string).length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(a.contact_value as string));
      if (!attribution) {
        return { status: 'skipped', reason: 'invalid_email' };
      }

      Promise.resolve(
        this.emailService.sendLawApprovedEmail(attribution.contact_value, { id: law.id, title: law.title, text: law.text, name: attribution.name }),
      )
        .then((outcome: { status: string }) => {
          if (outcome.status === 'sent') {
            this.adminLawService.markApprovalEmailSent(law.id);
          }
        })
        .catch((error: unknown) => console.error(`Thank-you email follow-up failed for law ID ${law.id}: ${error instanceof Error ? error.name : 'unknown error'}`));
      return { status: 'queued' };
    } catch (error) {
      console.error(`Thank-you email could not be started for law ID ${result?.law?.id}: ${error instanceof Error ? error.name : 'unknown error'}`);
      return { status: 'skipped', reason: 'error' };
    }
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
   * A valid session without the CSRF header or origin is refused with 403 and is not counted as a failed login.
   */
  private authorize(req: any, res: any): boolean {
    const access = getAdminAccess(req);
    if (access.status === 'disabled') {
      notFound(res, req);
      return false;
    }
    if (access.status === 'forbidden') {
      this.fail(res, 403, 'Forbidden', req);
      return false;
    }
    if (access.status === 'unauthorized') {
      const identifier = getVoterIdentifier(req);
      const rateLimit = checkRateLimit(identifier, 'admin-fail');
      if (!rateLimit.allowed) {
        rateLimitExceeded(res, rateLimit, req);
      } else {
        console.warn(`Admin auth failed from ${identifier}`);
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
    if (q.length > MAX_QUERY_LENGTH) {
      return this.fail(res, 400, `q must be at most ${MAX_QUERY_LENGTH} characters`, req);
    }

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
      body = await readBody(req, MAX_BODY_BYTES);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return this.fail(res, 413, 'Request body too large', req);
      }
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
      if (typeof body.text !== 'string') {
        return this.fail(res, 400, 'Law text must be a string', req);
      }
      const text = body.text.trim();
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

    if (body.category_id !== undefined) {
      if (typeof body.category_id !== 'number' || !Number.isInteger(body.category_id) || body.category_id <= 0) {
        return this.fail(res, 400, 'category_id must be a positive integer', req);
      }
      update.categoryId = body.category_id;
    }

    if (Object.keys(update).length === 0) {
      return this.fail(res, 400, 'No updatable fields provided', req);
    }

    // Optional: omitted or null means last write wins (a law without updated_at cannot be guarded).
    if (body.updated_at !== undefined && body.updated_at !== null) {
      if (typeof body.updated_at !== 'string') {
        return this.fail(res, 400, 'updated_at must be a string', req);
      }
      update.expectedUpdatedAt = body.updated_at;
    }

    const result = this.adminLawService.updateLaw(lawId, update);
    const actor = getVoterIdentifier(req);
    if (result.outcome === 'not_found') {
      console.warn(`Admin update of missing law ${lawId} from ${actor}`);
      return this.fail(res, 404, 'Law not found', req);
    }
    if (result.outcome === 'invalid_category') {
      console.warn(`Admin update of law ${lawId} from ${actor} rejected: unknown category ${update.categoryId}`);
      return this.fail(res, 400, 'Unknown category', req);
    }
    if (result.outcome === 'conflict') {
      console.warn(`Admin update of law ${lawId} from ${actor} rejected: law changed since it was loaded`);
      return this.fail(res, 409, 'This law changed since you loaded it. Reload the list and try again.', req);
    }

    const thankYou = this.thankSubmitter(result);
    console.log(JSON.stringify({
      event: 'admin_law_update',
      lawId,
      actor,
      fields: Object.keys(update).filter((key) => key !== 'expectedUpdatedAt'),
      statusFrom: result.previousStatus,
      statusTo: update.status ?? result.previousStatus,
      categoryFrom: update.categoryId === undefined ? undefined : result.previousCategoryIds,
      categoryTo: update.categoryId,
      guarded: update.expectedUpdatedAt !== undefined,
      thankYou: thankYou === null ? undefined : thankYou.status === 'queued' ? 'queued' : `skipped:${thankYou.reason}`,
    }));
    return this.json(res, 200, { data: result.law, thank_you: thankYou }, req);
  }
}
