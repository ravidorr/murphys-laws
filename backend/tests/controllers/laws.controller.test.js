import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LawController } from '../../src/controllers/laws.controller.mjs';
import * as httpHelpers from '../../src/utils/http-helpers.js';

// Mock rate limit middleware
vi.mock('../../src/middleware/rate-limit.mjs', () => ({
    checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetTime: 0 })),
}));

// Mock http helpers
vi.mock('../../src/utils/http-helpers.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        readBody: vi.fn(),
        getVoterIdentifier: vi.fn(() => '127.0.0.1'),
    };
});

// Import the mocked checkRateLimit to manipulate it in tests
import { checkRateLimit } from '../../src/middleware/rate-limit.mjs';

describe('LawController', () => {
    let lawService;
    let emailService;
    let lawController;
    let req;
    let res;

    beforeEach(() => {
        lawService = {
            listLaws: vi.fn(),
            getLaw: vi.fn(),
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
        };
        res = {
            writeHead: vi.fn(),
            end: vi.fn(),
        };
        
        // Reset mocks
        vi.clearAllMocks();
        checkRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetTime: 0 });
    });

    describe('list', () => {
        it('should list laws with defaults', async () => {
            lawService.listLaws.mockResolvedValue({ data: [], total: 0 });
            await lawController.list(req, res, { query: {} });

            expect(lawService.listLaws).toHaveBeenCalledWith({
                limit: 25,
                offset: 0,
                q: '',
                categoryId: null,
                categorySlug: null,
                attribution: '',
                sort: 'score',
                order: 'desc'
            });
            expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
        });

        it('should list laws with params', async () => {
            lawService.listLaws.mockResolvedValue({ data: [], total: 0 });
            const params = {
                limit: '10',
                offset: '20',
                q: 'test',
                category_id: '5',
                category_slug: 'test-cat',
                attribution: 'Murphy'
            };
            await lawController.list(req, res, { query: params });

            expect(lawService.listLaws).toHaveBeenCalledWith({
                limit: 10,
                offset: 20,
                q: 'test',
                categoryId: 5,
                categorySlug: 'test-cat',
                attribution: 'Murphy',
                sort: 'score',
                order: 'desc'
            });
        });

        it('should clamp invalid limit', async () => {
            lawService.listLaws.mockResolvedValue({ data: [], total: 0 });
            await lawController.list(req, res, { query: { limit: '1000' } });

            expect(lawService.listLaws).toHaveBeenCalledWith(expect.objectContaining({ limit: 25 }));
        });

        it('should pass valid sort and order parameters', async () => {
            lawService.listLaws.mockResolvedValue({ data: [], total: 0 });
            await lawController.list(req, res, { query: { sort: 'created_at', order: 'asc' } });

            expect(lawService.listLaws).toHaveBeenCalledWith(expect.objectContaining({
                sort: 'created_at',
                order: 'asc'
            }));
        });

        it('should reject invalid sort field and default to score', async () => {
            lawService.listLaws.mockResolvedValue({ data: [], total: 0 });
            await lawController.list(req, res, { query: { sort: 'invalid_field' } });

            expect(lawService.listLaws).toHaveBeenCalledWith(expect.objectContaining({
                sort: 'score'
            }));
        });

        it('should accept upvotes as sort field', async () => {
            lawService.listLaws.mockResolvedValue({ data: [], total: 0 });
            await lawController.list(req, res, { query: { sort: 'upvotes', order: 'desc' } });

            expect(lawService.listLaws).toHaveBeenCalledWith(expect.objectContaining({
                sort: 'upvotes',
                order: 'desc'
            }));
        });

        it('should accept last_voted_at as sort field', async () => {
            lawService.listLaws.mockResolvedValue({ data: [], total: 0 });
            await lawController.list(req, res, { query: { sort: 'last_voted_at', order: 'desc' } });

            expect(lawService.listLaws).toHaveBeenCalledWith(expect.objectContaining({
                sort: 'last_voted_at',
                order: 'desc'
            }));
        });

        it('should default invalid order to desc', async () => {
            lawService.listLaws.mockResolvedValue({ data: [], total: 0 });
            await lawController.list(req, res, { query: { order: 'invalid' } });

            expect(lawService.listLaws).toHaveBeenCalledWith(expect.objectContaining({
                order: 'desc'
            }));
        });
    });

    describe('get', () => {
        it('should get a law by valid ID', async () => {
            lawService.getLaw.mockResolvedValue({ id: 1, text: 'Law' });
            await lawController.get(req, res, '1');

            expect(lawService.getLaw).toHaveBeenCalledWith(1);
            expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
        });

        it('should return 400 for invalid ID', async () => {
            await lawController.get(req, res, 'invalid');
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 400 for negative ID', async () => {
            await lawController.get(req, res, '-1');
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 404 for missing law', async () => {
            lawService.getLaw.mockResolvedValue(null);
            await lawController.get(req, res, '999');
            expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
        });
    });

    describe('getLawOfTheDay', () => {
        it('should return law of the day', async () => {
            lawService.getLawOfTheDay.mockResolvedValue({ law: {}, featured_date: '2023-01-01' });
            await lawController.getLawOfTheDay(req, res);
            expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
        });

        it('should return 404 if no law', async () => {
            lawService.getLawOfTheDay.mockResolvedValue(null);
            await lawController.getLawOfTheDay(req, res);
            expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
        });
    });

    describe('submit', () => {
        it('should return 429 if rate limit exceeded', async () => {
            checkRateLimit.mockReturnValue({ allowed: false, resetTime: Date.now() + 1000 });
            await lawController.submit(req, res);
            expect(res.writeHead).toHaveBeenCalledWith(429, expect.any(Object));
        });

        it('should return 400 if text is missing', async () => {
            httpHelpers.readBody.mockResolvedValue({});
            await lawController.submit(req, res);
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 400 if text is too short', async () => {
            httpHelpers.readBody.mockResolvedValue({ text: 'Short' });
            await lawController.submit(req, res);
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 400 if text is too long', async () => {
            httpHelpers.readBody.mockResolvedValue({ text: 'a'.repeat(1001) });
            await lawController.submit(req, res);
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 400 if category_id is invalid', async () => {
            httpHelpers.readBody.mockResolvedValue({ text: 'Valid length text', category_id: 'invalid' });
            await lawController.submit(req, res);
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should submit valid law successfully', async () => {
            httpHelpers.readBody.mockResolvedValue({
                title: 'Title',
                text: 'This is a valid law text.',
                author: 'Author',
                email: 'test@example.com',
                category_id: '5'
            });
            lawService.submitLaw.mockResolvedValue(123);

            await lawController.submit(req, res);

            expect(lawService.submitLaw).toHaveBeenCalledWith({
                title: 'Title',
                text: 'This is a valid law text.',
                author: 'Author',
                email: 'test@example.com',
                categoryId: 5
            });
            expect(emailService.sendNewLawEmail).toHaveBeenCalled();
            expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
        });

        it('should return 400 if service throws error', async () => {
            httpHelpers.readBody.mockResolvedValue({ text: 'Valid length text' });
            lawService.submitLaw.mockRejectedValue(new Error('DB Error'));

            await lawController.submit(req, res);

            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });
    });
});