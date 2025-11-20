import { checkRateLimit } from '../middleware/rate-limit.mjs';
import { getVoterIdentifier, readBody, sendJson, badRequest, rateLimitExceeded, notFound } from '../utils/http-helpers.js';

export class VoteController {
  constructor(voteService, lawService) {
    this.voteService = voteService;
    this.lawService = lawService;
  }

  async vote(req, res, lawId) {
    const identifier = getVoterIdentifier(req);
    const rateLimit = checkRateLimit(identifier, 'vote');

    if (!rateLimit.allowed) {
      return rateLimitExceeded(res, rateLimit.resetTime, req);
    }

    const body = await readBody(req);
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

  async removeVote(req, res, lawId) {
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
