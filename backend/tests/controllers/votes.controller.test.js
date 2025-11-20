import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoteController } from '../../src/controllers/votes.controller.mjs';

describe('VoteController', () => {
    let voteService;
    let lawService;
    let voteController;
    let req;
    let res;

    beforeEach(() => {
        voteService = {
            vote: vi.fn(),
            removeVote: vi.fn(),
        };
        lawService = {
            getLaw: vi.fn(),
        };
        voteController = new VoteController(voteService, lawService);

        req = {
            headers: {},
            socket: { remoteAddress: '127.0.0.1' },
            on: vi.fn((event, cb) => {
                if (event === 'data') cb(Buffer.from(JSON.stringify({ vote_type: 'up' })));
                if (event === 'end') cb();
            }),
        };
        res = {
            writeHead: vi.fn(),
            end: vi.fn(),
        };
    });

    it('should cast a vote', async () => {
        lawService.getLaw.mockResolvedValue({ id: 1, upvotes: 1, downvotes: 0 });
        await voteController.vote(req, res, 1);

        expect(voteService.vote).toHaveBeenCalledWith(1, 'up', expect.any(String));
        expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('should return 404 if law not found', async () => {
        lawService.getLaw.mockResolvedValue(null);
        await voteController.vote(req, res, 999);

        expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });

    it('should return 400 if vote_type is invalid', async () => {
        req.on = vi.fn((event, cb) => {
            if (event === 'data') cb(Buffer.from(JSON.stringify({ vote_type: 'invalid' })));
            if (event === 'end') cb();
        });

        await voteController.vote(req, res, 1);
        expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    });

    it('should return 400 if vote_type is missing', async () => {
        req.on = vi.fn((event, cb) => {
            if (event === 'data') cb(Buffer.from(JSON.stringify({})));
            if (event === 'end') cb();
        });

        await voteController.vote(req, res, 1);
        expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    });

    it('should remove a vote successfully', async () => {
        lawService.getLaw.mockResolvedValue({ id: 1, upvotes: 0, downvotes: 0 });
        await voteController.removeVote(req, res, 1);

        expect(voteService.removeVote).toHaveBeenCalledWith(1, expect.any(String));
        expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('should return 404 when removing vote for non-existent law', async () => {
        lawService.getLaw.mockResolvedValue(null);
        await voteController.removeVote(req, res, 999);

        expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });
});
