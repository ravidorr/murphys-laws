import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LawController } from '../../src/controllers/laws.controller.mjs';

// Mock rate limit middleware
vi.mock('../../src/middleware/rate-limit.mjs', () => ({
    checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetTime: 0 })),
}));

describe('LawController', () => {
    let lawService;
    let emailService;
    let lawController;
    let req;
    let res;

    beforeEach(() => {
        lawService = {
            listLaws: vi.fn(),
            getLawOfTheDay: vi.fn(),
            submitLaw: vi.fn(),
        };
        emailService = {
            sendNewLawEmail: vi.fn().mockResolvedValue(true),
        };
        lawController = new LawController(lawService, emailService);

        req = {
            headers: {},
            socket: { remoteAddress: '127.0.0.1' },
            on: vi.fn((event, cb) => {
                if (event === 'end') cb();
            }),
        };
        res = {
            writeHead: vi.fn(),
            end: vi.fn(),
        };
    });

    it('should list laws', async () => {
        lawService.listLaws.mockResolvedValue({ data: [], total: 0 });
        await lawController.list(req, res, { query: {} });

        expect(lawService.listLaws).toHaveBeenCalled();
        expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
        expect(res.end).toHaveBeenCalled();
    });

    it('should get law of the day', async () => {
        lawService.getLawOfTheDay.mockResolvedValue({ law: {}, featured_date: '2023-01-01' });
        await lawController.getLawOfTheDay(req, res);

        expect(lawService.getLawOfTheDay).toHaveBeenCalled();
        expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('should return 404 if no law of the day', async () => {
        lawService.getLawOfTheDay.mockResolvedValue(null);
        await lawController.getLawOfTheDay(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });

    it('should submit a law', async () => {
        // Mock request body
        req.on = vi.fn((event, cb) => {
            if (event === 'data') cb(Buffer.from(JSON.stringify({ text: 'New Law Text' })));
            if (event === 'end') cb();
        });

        lawService.submitLaw.mockResolvedValue(1);
        await lawController.submit(req, res);

        // console.log('res.writeHead calls:', res.writeHead.mock.calls);

        expect(lawService.submitLaw).toHaveBeenCalledWith(expect.objectContaining({ text: 'New Law Text' }));
        expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
        // expect(res.end).toHaveBeenCalledWith(expect.stringContaining('success'));
    });
});
