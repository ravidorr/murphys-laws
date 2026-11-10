import { getAdminAccess } from '../middleware/admin-auth.ts';
import { checkRateLimit } from '../middleware/rate-limit.ts';
import { ADMIN_LAW_STATUSES, type AdminLawStatus, type AdminLawUpdate, type AdminSplitInput } from '../services/admin-laws.service.ts';
import { BodyError, parseCorollaryList, parseText, parseTitle } from '../utils/corollary-input.ts';
import { getVoterIdentifier, readBody, sendJson, notFound, rateLimitExceeded, PayloadTooLargeError } from '../utils/http-helpers.ts';

const MAX_NOTES_LENGTH = 2000;
const MAX_QUERY_LENGTH = 200;
const MAX_BODY_BYTES = 16 * 1024;
// Room for the parent, up to five corollaries and their titles, with multi-byte text, so a split gets a larger cap.
const MAX_SPLIT_BODY_BYTES = 64 * 1024;
// One plain address: no whitespace, list separators, group or display-name syntax, quotes or brackets.
const EMAIL_PATTERN = /^[^\s@,;:<>()"\\[\]]+@[^\s@,;:<>()"\\[\]]+\.[^\s@,;:<>()"\\[\]]+$/;
const MAX_EMAIL_LENGTH = 254;
const NO_STORE = { 'Cache-Control': 'no-store' };
const CONFLICT_MESSAGE = 'This law changed since you loaded it. Reload the list and try again.';

type ThankYou = { status: 'queued' } | { status: 'skipped'; reason: string } | null;

/** The audit-log form of the thank-you outcome; undefined when the update was not an approval. */
function describeThankYou(thankYou: ThankYou): string | undefined {
  if (thankYou === null) {
    return undefined;
  }
  return thankYou.status === 'queued' ? 'queued' : `skipped:${thankYou.reason}`;
}

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

function parseNotes(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new BodyError('admin_notes must be a string or null');
  }
  const notes = value.trim();
  if (notes.length > MAX_NOTES_LENGTH) {
    throw new BodyError(`admin_notes must be at most ${MAX_NOTES_LENGTH} characters`);
  }
  return notes || null;
}

function parseCategoryId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new BodyError('category_id must be a positive integer');
  }
  return value;
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
      // Corollaries are credited by name only and never carry an address; the one thank-you belongs to the parent.
      if (result.isCorollary) {
        return { status: 'skipped', reason: 'corollary' };
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

      // Only the corollaries that went live with the law; a rejected one is not announced.
      const corollaries = this.adminLawService.publishedCorollaries(law.id);
      Promise.resolve(
        this.emailService.sendLawApprovedEmail(attribution.contact_value, { id: law.id, title: law.title, text: law.text, name: attribution.name, corollaries }),
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

  private parseUpdate(body: Record<string, any>): AdminLawUpdate {
    const update: AdminLawUpdate = {};

    if (body.status !== undefined) {
      if (!isStatus(body.status)) {
        throw new BodyError('Invalid status');
      }
      update.status = body.status;
    }
    if (body.text !== undefined) {
      update.text = parseText(body.text, 'Law text', 'Law text must be a string');
    }
    if (body.title !== undefined) {
      update.title = parseTitle(body.title, 'Title', 'Title must be a string or null');
    }
    if (body.admin_notes !== undefined) {
      update.adminNotes = parseNotes(body.admin_notes);
    }
    if (body.category_id !== undefined) {
      update.categoryId = parseCategoryId(body.category_id);
    }
    if (Object.keys(update).length === 0) {
      throw new BodyError('No updatable fields provided');
    }
    // Optional: omitted or null means last write wins (a law without updated_at cannot be guarded).
    if (body.updated_at !== undefined && body.updated_at !== null) {
      if (typeof body.updated_at !== 'string') {
        throw new BodyError('updated_at must be a string');
      }
      update.expectedUpdatedAt = body.updated_at;
    }
    return update;
  }

  private parseSplit(body: Record<string, any>): AdminSplitInput {
    if (typeof body.updated_at !== 'string' || body.updated_at === '') {
      throw new BodyError('updated_at is required');
    }
    const parentText = parseText(body.parent_text, 'Law text', 'parent_text must be a string');
    const split: AdminSplitInput = {
      expectedUpdatedAt: body.updated_at,
      parentText,
      corollaries: parseCorollaryList(body.corollaries, parentText, 1),
    };
    if (body.title !== undefined) {
      split.title = parseTitle(body.title, 'Title', 'Title must be a string or null');
    }
    if (body.admin_notes !== undefined) {
      split.adminNotes = parseNotes(body.admin_notes);
    }
    if (body.category_id !== undefined) {
      split.categoryId = parseCategoryId(body.category_id);
    }
    return split;
  }

  async update(req: any, res: any, id: string) {
    if (!this.authorize(req, res)) return;

    const lawId = Number(id);
    if (!Number.isInteger(lawId) || lawId <= 0) {
      return this.fail(res, 400, 'Invalid law ID', req);
    }

    const body = await this.readObject(req, res, MAX_BODY_BYTES);
    if (body === null) return;

    const update = this.parseBody(req, res, () => this.parseUpdate(body));
    if (update === null) return;

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
    if (result.outcome === 'parent_not_published') {
      console.warn(`Admin update of law ${lawId} from ${actor} rejected: parent ${result.parentId} is not published`);
      return this.fail(res, 400, `This corollary cannot be published while its law (#${result.parentId}) is not. Approve the law instead.`, req);
    }
    if (result.outcome === 'conflict') {
      console.warn(`Admin update of law ${lawId} from ${actor} rejected: law changed since it was loaded`);
      return this.fail(res, 409, CONFLICT_MESSAGE, req);
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
      cascaded: result.cascaded || undefined,
      thankYou: describeThankYou(thankYou),
    }));
    return this.json(res, 200, { data: result.law, thank_you: thankYou, cascaded: result.cascaded }, req);
  }

  /**
   * Publishes a law in review and creates its corollaries as published laws of their own, in one transaction.
   * The body is the moderator's explicit decision (parent text and each corollary), so nothing is parsed again here.
   */
  async split(req: any, res: any, id: string) {
    if (!this.authorize(req, res)) return;

    const lawId = Number(id);
    if (!Number.isInteger(lawId) || lawId <= 0) {
      return this.fail(res, 400, 'Invalid law ID', req);
    }
    const body = await this.readObject(req, res, MAX_SPLIT_BODY_BYTES);
    if (body === null) return;

    const split = this.parseBody(req, res, () => this.parseSplit(body));
    if (split === null) return;

    const result = this.adminLawService.splitLaw(lawId, split);
    const actor = getVoterIdentifier(req);
    if (result.outcome === 'not_found') {
      console.warn(`Admin split of missing law ${lawId} from ${actor}`);
      return this.fail(res, 404, 'Law not found', req);
    }
    if (result.outcome === 'invalid_category') {
      console.warn(`Admin split of law ${lawId} from ${actor} rejected: unknown category ${split.categoryId}`);
      return this.fail(res, 400, 'Unknown category', req);
    }
    if (result.outcome === 'conflict') {
      console.warn(`Admin split of law ${lawId} from ${actor} rejected: law changed since it was loaded`);
      return this.fail(res, 409, CONFLICT_MESSAGE, req);
    }
    if (result.outcome === 'invalid') {
      console.warn(`Admin split of law ${lawId} from ${actor} rejected: ${result.message}`);
      return this.fail(res, result.status, result.message, req);
    }

    // Only the parent is thanked: the corollaries were credited by name and carry no address.
    const thankYou = this.thankSubmitter(result);
    console.log(JSON.stringify({
      event: 'admin_law_split',
      lawId,
      actor,
      corollaryIds: result.children.map((child: { id: number }) => child.id),
      corollaryCount: result.children.length,
      fields: ['text', 'title', 'adminNotes', 'categoryId'].filter((field) => field === 'text' || split[field as keyof AdminSplitInput] !== undefined),
      categoryFrom: split.categoryId === undefined ? undefined : result.previousCategoryIds,
      categoryTo: split.categoryId,
      thankYou: describeThankYou(thankYou),
    }));
    return this.json(res, 200, { data: result.law, corollaries: result.children, thank_you: thankYou }, req);
  }

  /** Runs a body parser; when it reports a broken rule the 400 has been sent and null is returned. */
  private parseBody<T>(req: any, res: any, parse: () => T): T | null {
    try {
      return parse();
    } catch (error) {
      if (error instanceof BodyError) {
        this.fail(res, 400, error.message, req);
        return null;
      }
      throw error;
    }
  }

  /** Reads a JSON object body; when it cannot, the error response has been sent and null is returned. */
  private async readObject(req: any, res: any, maxBytes: number): Promise<Record<string, any> | null> {
    let body: any;
    try {
      body = await readBody(req, maxBytes);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        this.fail(res, 413, 'Request body too large', req);
        return null;
      }
      if (error instanceof SyntaxError) {
        this.fail(res, 400, 'Invalid JSON body', req);
        return null;
      }
      throw error;
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      this.fail(res, 400, 'Body must be a JSON object', req);
      return null;
    }
    return body;
  }
}
