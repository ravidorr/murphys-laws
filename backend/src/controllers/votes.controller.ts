import { checkRateLimit } from '../middleware/rate-limit.ts';
import { getVoterIdentifier, readBody, sendJson, badRequest, rateLimitExceeded, notFound } from '../utils/http-helpers.ts';

export class VoteController {
  voteService: any;
  lawService: any;

  constructor(voteService: any, lawService: any) {
    this.voteService = voteService;
    this.lawService = lawService;
  }

  async vote(req: any, res: any, lawId: number) {
    const identifier = getVoterIdentifier(req);
    const rateLimit = checkRateLimit(identifier, 'vote');

    if (!rateLimit.allowed) {
      return rateLimitExceeded(res, rateLimit.resetTime, req);
    }

    let body: any;
    try {
      body = await readBody(req);
    } catch {
      return badRequest(res, 'Invalid JSON body', req);
    }
    const voteType = body.vote_type;

    // Validate vote_type
    if (!voteType || !['up', 'down'].includes(voteType)) {
      return badRequest(res, 'vote_type must be "up" or "down"', req);
    }

    const law = await this.lawService.getLaw(lawId);
    if (!law) {
      return notFound(res, req);
    }

    const voterIdentifier = getVoterIdentifier(req);
    await this.voteService.vote(lawId, voteType, voterIdentifier);

    const updatedLaw = await this.lawService.getLaw(lawId);

    return sendJson(res, 200, {
      law_id: lawId,
      vote_type: voteType,
      upvotes: updatedLaw.upvotes,
      downvotes: updatedLaw.downvotes
    }, req);
  }

  async removeVote(req: any, res: any, lawId: number) {
    const identifier = getVoterIdentifier(req);
    const rateLimit = checkRateLimit(identifier, 'vote');

    if (!rateLimit.allowed) {
      return rateLimitExceeded(res, rateLimit.resetTime, req);
    }

    const law = await this.lawService.getLaw(lawId);
    if (!law) {
      return notFound(res, req);
    }

    const voterIdentifier = getVoterIdentifier(req);
    await this.voteService.removeVote(lawId, voterIdentifier);

    const updatedLaw = await this.lawService.getLaw(lawId);

    return sendJson(res, 200, {
      law_id: lawId,
      upvotes: updatedLaw.upvotes,
      downvotes: updatedLaw.downvotes
    }, req);
  }
}
