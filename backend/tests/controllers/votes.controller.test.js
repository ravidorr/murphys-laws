import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoteController } from '../../src/controllers/votes.controller.mjs';
import * as rateLimitModule from '../../src/middleware/rate-limit.mjs';

describe('VoteController', () => {
    let localThis;

    beforeEach(() => {
        localThis = {
            voteService: {
                vote: vi.fn(),
                removeVote: vi.fn(),
            },
            lawService: {
                getLaw: vi.fn(),
            },
            voteController: null,
            req: {
                headers: {},
                socket: { remoteAddress: '127.0.0.1' },
                on: vi.fn((event, cb) => {
                    if (event === 'data') cb(Buffer.from(JSON.stringify({ vote_type: 'up' })));
                    if (event === 'end') cb();
                }),
            },
            res: {
                writeHead: vi.fn(),
                end: vi.fn(),
            },
        };
        localThis.voteController = new VoteController(localThis.voteService, localThis.lawService);
        
        // Reset rate limit mock to default (allowed)
        vi.spyOn(rateLimitModule, 'checkRateLimit').mockReturnValue({
            allowed: true,
            remaining: 29,
            resetTime: Date.now() + 60000,
        });
    });

    it('should cast a vote', async () => {
        localThis.lawService.getLaw.mockResolvedValue({ id: 1, upvotes: 1, downvotes: 0 });
        await localThis.voteController.vote(localThis.req, localThis.res, 1);

        expect(localThis.voteService.vote).toHaveBeenCalledWith(1, 'up', expect.any(String));
        expect(localThis.res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('should return 404 if law not found', async () => {
        localThis.lawService.getLaw.mockResolvedValue(null);
        await localThis.voteController.vote(localThis.req, localThis.res, 999);

        expect(localThis.res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });

    it('should return 400 if vote_type is invalid', async () => {
        localThis.req.on = vi.fn((event, cb) => {
            if (event === 'data') cb(Buffer.from(JSON.stringify({ vote_type: 'invalid' })));
            if (event === 'end') cb();
        });

        await localThis.voteController.vote(localThis.req, localThis.res, 1);
        expect(localThis.res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    });

    it('should return 400 if vote_type is missing', async () => {
        localThis.req.on = vi.fn((event, cb) => {
            if (event === 'data') cb(Buffer.from(JSON.stringify({})));
            if (event === 'end') cb();
        });

        await localThis.voteController.vote(localThis.req, localThis.res, 1);
        expect(localThis.res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    });

    it('should remove a vote successfully', async () => {
        localThis.lawService.getLaw.mockResolvedValue({ id: 1, upvotes: 0, downvotes: 0 });
        await localThis.voteController.removeVote(localThis.req, localThis.res, 1);

        expect(localThis.voteService.removeVote).toHaveBeenCalledWith(1, expect.any(String));
        expect(localThis.res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('should return 404 when removing vote for non-existent law', async () => {
        localThis.lawService.getLaw.mockResolvedValue(null);
        await localThis.voteController.removeVote(localThis.req, localThis.res, 999);

        expect(localThis.res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });

    it('should return 429 when rate limit exceeded on vote', async () => {
        vi.spyOn(rateLimitModule, 'checkRateLimit').mockReturnValue({
            allowed: false,
            remaining: 0,
            resetTime: Date.now() + 60000,
        });

        await localThis.voteController.vote(localThis.req, localThis.res, 1);

        expect(localThis.res.writeHead).toHaveBeenCalledWith(429, expect.any(Object));
        expect(localThis.voteService.vote).not.toHaveBeenCalled();
    });

    it('should return 429 when rate limit exceeded on removeVote', async () => {
        vi.spyOn(rateLimitModule, 'checkRateLimit').mockReturnValue({
            allowed: false,
            remaining: 0,
            resetTime: Date.now() + 60000,
        });

        await localThis.voteController.removeVote(localThis.req, localThis.res, 1);

        expect(localThis.res.writeHead).toHaveBeenCalledWith(429, expect.any(Object));
        expect(localThis.voteService.removeVote).not.toHaveBeenCalled();
    });
});
