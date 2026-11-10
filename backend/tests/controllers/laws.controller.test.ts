import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LawController } from '../../src/controllers/laws.controller.ts';
import * as httpHelpers from '../../src/utils/http-helpers.ts';

// Mock rate limit middleware
vi.mock('../../src/middleware/rate-limit.ts', () => ({
    checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetTime: 0 })),
}));

// Mock http helpers
vi.mock('../../src/utils/http-helpers.ts', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
        ...actual,
        readBody: vi.fn(),
        getVoterIdentifier: vi.fn(() => '127.0.0.1'),
    };
});

// Import the mocked checkRateLimit to manipulate it in tests
import { checkRateLimit } from '../../src/middleware/rate-limit.ts';

interface LawServiceMock {
    listLaws: ReturnType<typeof vi.fn>;
    getLaw: ReturnType<typeof vi.fn>;
    getLawOfTheDay: ReturnType<typeof vi.fn>;
    getRandomLaw: ReturnType<typeof vi.fn>;
    submitLaw: ReturnType<typeof vi.fn>;
    suggestions: ReturnType<typeof vi.fn>;
    getRelatedLaws: ReturnType<typeof vi.fn>;
    findDuplicateCandidates: ReturnType<typeof vi.fn>;
}

interface EmailServiceMock {
    sendNewLawEmail: ReturnType<typeof vi.fn>;
}

interface ReqMock {
    headers: Record<string, string | undefined>;
    socket: { remoteAddress: string };
    url?: string;
}

interface ResMock {
    writeHead: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
}

describe('LawController', () => {
    let lawService: LawServiceMock;
    let emailService: EmailServiceMock;
    let lawController: LawController;
    let req: ReqMock;
    let res: ResMock;

    beforeEach(() => {
        lawService = {
            listLaws: vi.fn(),
            getLaw: vi.fn(),
            getLawOfTheDay: vi.fn(),
            getRandomLaw: vi.fn(),
            submitLaw: vi.fn(),
            suggestions: vi.fn(),
            getRelatedLaws: vi.fn(),
            findDuplicateCandidates: vi.fn(),
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
        vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, limit: 3, remaining: 10, resetTime: 0 });
    });

    describe('duplicates', () => {
        it('returns duplicate candidates for valid text', async () => {
            lawService.findDuplicateCandidates.mockResolvedValue([{ id: 1, text: 'Existing law' }]);
            await lawController.duplicates(req, res, { query: { text: 'Existing law with enough text' } });

            expect(lawService.findDuplicateCandidates).toHaveBeenCalledWith({ text: 'Existing law with enough text', limit: 5 });
            expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
        });

        it('rejects duplicate checks with short text', async () => {
            await lawController.duplicates(req, res, { query: { text: 'short' } });

            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('rejects duplicate checks when text is omitted', async () => {
            await lawController.duplicates(req, res, { query: {} });

            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });
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
                order: 'desc',
                excludeCorollaries: false
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
                sort: 'relevance',
                order: 'desc',
                excludeCorollaries: false
            });
        });

        it('should pass excludeCorollaries when exclude_corollaries=1', async () => {
            lawService.listLaws.mockResolvedValue({ data: [], total: 0 });
            await lawController.list(req, res, { query: { exclude_corollaries: '1' } });

            expect(lawService.listLaws).toHaveBeenCalledWith(expect.objectContaining({
                excludeCorollaries: true
            }));
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
            await lawController.get(req, res, 1);

            expect(lawService.getLaw).toHaveBeenCalledWith(1);
            expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
        });

        it('should return 400 for invalid ID', async () => {
            await lawController.get(req, res, NaN);
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 400 for negative ID', async () => {
            await lawController.get(req, res, -1);
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 404 for missing law', async () => {
            lawService.getLaw.mockResolvedValue(null);
            await lawController.get(req, res, 999);
            expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
        });
    });

    describe('getRelated', () => {
        it('should return 400 for invalid law ID', async () => {
            req.url = '/api/v1/laws/invalid/related';
            req.headers.host = 'localhost:8787';
            await lawController.getRelated(req, res, NaN);
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 400 for negative law ID', async () => {
            req.url = '/api/v1/laws/-1/related';
            req.headers.host = 'localhost:8787';
            await lawController.getRelated(req, res, -1);
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 400 for zero law ID', async () => {
            req.url = '/api/v1/laws/0/related';
            req.headers.host = 'localhost:8787';
            await lawController.getRelated(req, res, 0);
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 404 for non-existent law', async () => {
            req.url = '/api/v1/laws/999999/related';
            req.headers.host = 'localhost:8787';
            lawService.getLaw.mockResolvedValue(null);

            await lawController.getRelated(req, res, 999999);

            expect(lawService.getLaw).toHaveBeenCalledWith(999999);
            expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
        });

        it('should return related laws with default limit', async () => {
            req.url = '/api/v1/laws/1/related';
            req.headers.host = 'localhost:8787';
            lawService.getLaw.mockResolvedValue({ id: 1, text: 'Test Law' });
            const relatedLaws = [
                { id: 2, text: 'Related 1', upvotes: 5, downvotes: 1, score: 4 },
                { id: 3, text: 'Related 2', upvotes: 3, downvotes: 0, score: 3 }
            ];
            lawService.getRelatedLaws.mockResolvedValue(relatedLaws);

            await lawController.getRelated(req, res, 1);

            expect(lawService.getLaw).toHaveBeenCalledWith(1);
            expect(lawService.getRelatedLaws).toHaveBeenCalledWith(1, { limit: 5 });
            expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
        });

        it('should respect limit parameter', async () => {
            req.url = '/api/v1/laws/1/related?limit=3';
            req.headers.host = 'localhost:8787';
            lawService.getLaw.mockResolvedValue({ id: 1, text: 'Test Law' });
            lawService.getRelatedLaws.mockResolvedValue([]);

            await lawController.getRelated(req, res, 1);

            expect(lawService.getRelatedLaws).toHaveBeenCalledWith(1, { limit: 3 });
        });

        it('should clamp limit to minimum of 1', async () => {
            req.url = '/api/v1/laws/1/related?limit=0';
            req.headers.host = 'localhost:8787';
            lawService.getLaw.mockResolvedValue({ id: 1, text: 'Test Law' });
            lawService.getRelatedLaws.mockResolvedValue([]);

            await lawController.getRelated(req, res, 1);

            expect(lawService.getRelatedLaws).toHaveBeenCalledWith(1, { limit: 1 });
        });

        it('should clamp limit to maximum of 10', async () => {
            req.url = '/api/v1/laws/1/related?limit=100';
            req.headers.host = 'localhost:8787';
            lawService.getLaw.mockResolvedValue({ id: 1, text: 'Test Law' });
            lawService.getRelatedLaws.mockResolvedValue([]);

            await lawController.getRelated(req, res, 1);

            expect(lawService.getRelatedLaws).toHaveBeenCalledWith(1, { limit: 10 });
        });

        it('should reject a non-numeric limit', async () => {
            req.url = '/api/v1/laws/1/related?limit=abc';
            req.headers.host = 'localhost:8787';
            lawService.getLaw.mockResolvedValue({ id: 1, text: 'Test Law' });
            lawService.getRelatedLaws.mockResolvedValue([]);

            await lawController.getRelated(req, res, 1);

            expect(lawService.getRelatedLaws).not.toHaveBeenCalled();
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should reject a fractional limit', async () => {
            req.url = '/api/v1/laws/1/related?limit=1.5';
            req.headers.host = 'localhost:8787';
            lawService.getLaw.mockResolvedValue({ id: 1, text: 'Test Law' });
            lawService.getRelatedLaws.mockResolvedValue([]);

            await lawController.getRelated(req, res, 1);

            expect(lawService.getRelatedLaws).not.toHaveBeenCalled();
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return response with data and law_id', async () => {
            req.url = '/api/v1/laws/42/related';
            req.headers.host = 'localhost:8787';
            lawService.getLaw.mockResolvedValue({ id: 42, text: 'Test Law' });
            const relatedLaws = [{ id: 5, text: 'Related Law' }];
            lawService.getRelatedLaws.mockResolvedValue(relatedLaws);

            await lawController.getRelated(req, res, 42);

            expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
            // Verify the response structure by checking res.end was called with correct JSON
            const endCall = res.end.mock.calls[0][0];
            const responseBody = JSON.parse(endCall);
            expect(responseBody.data).toEqual(relatedLaws);
            expect(responseBody.law_id).toBe(42);
        });

        it('should return empty array when no related laws found', async () => {
            req.url = '/api/v1/laws/1/related';
            req.headers.host = 'localhost:8787';
            lawService.getLaw.mockResolvedValue({ id: 1, text: 'Test Law' });
            lawService.getRelatedLaws.mockResolvedValue([]);

            await lawController.getRelated(req, res, 1);

            expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
            const endCall = res.end.mock.calls[0][0];
            const responseBody = JSON.parse(endCall);
            expect(responseBody.data).toEqual([]);
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
            vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, limit: 3, remaining: 0, resetTime: Date.now() + 1000 });
            await lawController.submit(req, res);
            expect(res.writeHead).toHaveBeenCalledWith(429, expect.any(Object));
        });

        it('should return 400 for invalid JSON body', async () => {
            vi.mocked(httpHelpers.readBody).mockRejectedValue(new SyntaxError('Unexpected token'));

            await lawController.submit(req, res);

            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
            expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({ error: 'Invalid JSON body' });
        });

        it('should return 400 if text is missing', async () => {
            vi.mocked(httpHelpers.readBody).mockResolvedValue({});
            await lawController.submit(req, res);
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 400 if text is too short', async () => {
            vi.mocked(httpHelpers.readBody).mockResolvedValue({ text: 'Short' });
            await lawController.submit(req, res);
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 400 if text is too long', async () => {
            vi.mocked(httpHelpers.readBody).mockResolvedValue({ text: 'a'.repeat(1001) });
            await lawController.submit(req, res);
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 400 if category_id is invalid', async () => {
            vi.mocked(httpHelpers.readBody).mockResolvedValue({ text: 'Valid length text', category_id: 'invalid' });
            await lawController.submit(req, res);
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should submit valid law successfully', async () => {
            vi.mocked(httpHelpers.readBody).mockResolvedValue({
                title: 'Title',
                text: 'This is a valid law text.',
                author: 'Author',
                email: 'test@example.com',
                category_id: '5'
            });
            lawService.submitLaw.mockResolvedValue({ id: 123, corollaries: [] });

            await lawController.submit(req, res);

            expect(lawService.submitLaw).toHaveBeenCalledWith({
                title: 'Title',
                text: 'This is a valid law text.',
                author: 'Author',
                email: 'test@example.com',
                categoryId: 5,
                corollaries: []
            });
            expect(emailService.sendNewLawEmail).toHaveBeenCalled();
            expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
        });

        it('should return 201 when sendNewLawEmail rejects (email failure does not fail request)', async () => {
            vi.mocked(httpHelpers.readBody).mockResolvedValue({
                title: 'T',
                text: 'Valid law text here.',
                author: 'A',
                email: 'a@example.com'
            });
            lawService.submitLaw.mockResolvedValue({ id: 456, corollaries: [] });
            emailService.sendNewLawEmail.mockRejectedValue(new Error('SMTP failed'));

            await lawController.submit(req, res);

            expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
            const body = JSON.parse(res.end.mock.calls[0][0]);
            expect(body.id).toBe(456);
            expect(body.status).toBe('in_review');
            expect(body.message).toContain('successfully');
        });

        describe('corollaries', () => {
            const TEXT = 'A red light turns green right after you stop watching it.';
            const ONE = 'The engine restarts slowly when someone behind you is honking.';
            const TWO = 'The green lasts just long enough for you to miss it.';
            const submitWith = async (corollaries: unknown, over: Record<string, unknown> = {}) => {
                vi.mocked(httpHelpers.readBody).mockResolvedValue({ text: TEXT, author: 'Ann', email: 'ann@example.com', corollaries, ...over });
                await lawController.submit(req, res);
            };
            const status = () => res.writeHead.mock.calls[0][0];
            const payload = () => JSON.parse(res.end.mock.calls[0][0]);

            it('reads the body with a 32 KB cap', async () => {
                lawService.submitLaw.mockResolvedValue({ id: 1, corollaries: [] });
                await submitWith(undefined);
                expect(vi.mocked(httpHelpers.readBody).mock.calls[0][1]).toBe(32 * 1024);
            });

            it('answers 413 when the body is over the cap, without touching the service', async () => {
                vi.mocked(httpHelpers.readBody).mockRejectedValue(new httpHelpers.PayloadTooLargeError());
                await lawController.submit(req, res);
                expect(status()).toBe(413);
                expect(payload()).toEqual({ error: 'Your submission is too large. Shorten the law or its corollaries and try again.' });
                expect(lawService.submitLaw).not.toHaveBeenCalled();
            });

            it.each([['null', null], ['an array', []], ['a string', 'text']])('rejects a body that is %s', async (_name, body) => {
                vi.mocked(httpHelpers.readBody).mockResolvedValue(body as never);
                await lawController.submit(req, res);
                expect(status()).toBe(400);
                expect(payload()).toEqual({ error: 'Body must be a JSON object' });
            });

            it('passes trimmed corollaries to the service and answers with the created ones, in the email too', async () => {
                const created = [{ id: 11, title: 'Ignition', text: ONE }, { id: 12, title: null, text: TWO }];
                lawService.submitLaw.mockResolvedValue({ id: 10, corollaries: created });

                await submitWith([{ title: ' Ignition ', text: `  ${ONE}  ` }, { text: TWO }]);

                expect(lawService.submitLaw).toHaveBeenCalledWith(expect.objectContaining({
                    corollaries: [{ title: 'Ignition', text: ONE }, { title: null, text: TWO }]
                }));
                expect(status()).toBe(201);
                expect(payload()).toMatchObject({ id: 10, status: 'in_review', corollaries: created });
                expect(emailService.sendNewLawEmail).toHaveBeenCalledWith(expect.objectContaining({ id: 10, corollaries: created }));
            });

            it('treats an absent or null list as no corollaries and answers with an empty list', async () => {
                lawService.submitLaw.mockResolvedValue({ id: 10, corollaries: [] });
                await submitWith(null);
                expect(lawService.submitLaw).toHaveBeenCalledWith(expect.objectContaining({ corollaries: [] }));
                expect(payload().corollaries).toEqual([]);
            });

            it('accepts an empty list and exactly five corollaries, and hands them to the service whole', async () => {
                lawService.submitLaw.mockResolvedValue({ id: 10, corollaries: [] });
                await submitWith([]);
                expect(status()).toBe(201);
                expect(lawService.submitLaw).toHaveBeenLastCalledWith(expect.objectContaining({ corollaries: [] }));

                res.writeHead.mockClear();
                const five = [1, 2, 3, 4, 5].map((n) => ({ text: `Corollary number ${n} of the law` }));
                await submitWith(five);
                expect(status()).toBe(201);
                expect(lawService.submitLaw).toHaveBeenLastCalledWith(expect.objectContaining({
                    corollaries: five.map((c) => ({ title: null, text: c.text }))
                }));
            });

            it('does not turn an unexpected failure while reading the list into a validation message', async () => {
                const broken = { get text(): string { throw new TypeError('engine detail'); } };
                await expect(submitWith([broken])).rejects.toThrow('engine detail');
                expect(lawService.submitLaw).not.toHaveBeenCalled();
            });

            it.each([
                ['not a list', 'nope', 'corollaries must be a list'],
                ['an object', { text: ONE }, 'corollaries must be a list'],
                ['more than five', [1, 2, 3, 4, 5, 6].map((n) => ({ text: `Corollary number ${n} of the law` })), 'Provide at most 5 corollaries'],
                ['an entry that is not an object', ['text'], 'Corollary 1 must be an object'],
                ['an entry that is null', [null], 'Corollary 1 must be an object'],
                ['an entry that is an array', [[ONE]], 'Corollary 1 must be an object'],
                ['a missing text', [{ title: 'x' }], 'Corollary 1 text must be a string'],
                ['a text that is not a string', [{ text: 5 }], 'Corollary 1 text must be a string'],
                ['a text under 10 characters', [{ text: 'too short' }], 'Corollary 1 must be between 10 and 1000 characters'],
                ['a blank text', [{ text: '          ' }], 'Corollary 1 must be between 10 and 1000 characters'],
                ['a text over 1000 characters', [{ text: 'a'.repeat(1001) }], 'Corollary 1 must be between 10 and 1000 characters'],
                ['a title that is not a string', [{ title: 5, text: ONE }], 'Corollary 1 title must be a string or null'],
                ['a title over 200 characters', [{ title: 't'.repeat(201), text: ONE }], 'Corollary 1 title must be at most 200 characters'],
                ['a corollary repeating another', [{ text: ONE }, { text: `  ${ONE.toUpperCase()}` }], 'Corollary 2 repeats another corollary or the law text'],
                ['a corollary equal to the law text', [{ text: TEXT }], 'Corollary 1 repeats another corollary or the law text'],
            ])('answers 400 for %s', async (_name, corollaries, message) => {
                await submitWith(corollaries);
                expect(status()).toBe(400);
                expect(payload()).toEqual({ error: message });
                expect(lawService.submitLaw).not.toHaveBeenCalled();
                expect(emailService.sendNewLawEmail).not.toHaveBeenCalled();
            });

            it('accepts a corollary title of exactly 200 characters and a text of exactly 10 and 1000', async () => {
                lawService.submitLaw.mockResolvedValue({ id: 10, corollaries: [] });
                await submitWith([{ title: 't'.repeat(200), text: 'a'.repeat(10) }, { text: 'b'.repeat(1000) }]);
                expect(status()).toBe(201);
                expect(lawService.submitLaw).toHaveBeenLastCalledWith(expect.objectContaining({
                    corollaries: [{ title: 't'.repeat(200), text: 'a'.repeat(10) }, { title: null, text: 'b'.repeat(1000) }]
                }));
            });

            it('turns a refusal from the service into a 400 with its message', async () => {
                lawService.submitLaw.mockRejectedValue(new Error('A law can have at most 5 corollaries'));
                await submitWith([{ text: ONE }]);
                expect(status()).toBe(400);
                expect(payload()).toEqual({ error: 'A law can have at most 5 corollaries' });
            });
        });

        it('should return 400 if service throws error', async () => {
            vi.mocked(httpHelpers.readBody).mockResolvedValue({ text: 'Valid length text' });
            lawService.submitLaw.mockRejectedValue(new Error('DB Error'));

            await lawController.submit(req, res);

            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });
    });

    describe('suggestions', () => {
        it('should return suggestions for valid query', async () => {
            lawService.suggestions.mockResolvedValue({ data: [{ id: 1, text: 'Test law' }] });
            await lawController.suggestions(req, res, { query: { q: 'test', limit: '10' } });

            expect(lawService.suggestions).toHaveBeenCalledWith({ q: 'test', limit: 10 });
            expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
        });

        it('should return 400 for query shorter than 2 characters', async () => {
            await lawController.suggestions(req, res, { query: { q: 'a' } });
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 400 for empty query', async () => {
            await lawController.suggestions(req, res, { query: { q: '' } });
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should return 400 for missing query parameter', async () => {
            await lawController.suggestions(req, res, { query: {} });
            expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
        });

        it('should use default limit of 10 when not provided', async () => {
            lawService.suggestions.mockResolvedValue({ data: [] });
            await lawController.suggestions(req, res, { query: { q: 'test' } });

            expect(lawService.suggestions).toHaveBeenCalledWith({ q: 'test', limit: 10 });
        });

        it('should cap limit at 20', async () => {
            lawService.suggestions.mockResolvedValue({ data: [] });
            await lawController.suggestions(req, res, { query: { q: 'test', limit: '100' } });

            expect(lawService.suggestions).toHaveBeenCalledWith({ q: 'test', limit: 20 });
        });

        it('should handle minimum limit of 1', async () => {
            lawService.suggestions.mockResolvedValue({ data: [] });
            await lawController.suggestions(req, res, { query: { q: 'test', limit: '0' } });

            expect(lawService.suggestions).toHaveBeenCalledWith({ q: 'test', limit: 1 });
        });

        it('should trim query parameter', async () => {
            lawService.suggestions.mockResolvedValue({ data: [] });
            await lawController.suggestions(req, res, { query: { q: '  test  ', limit: '10' } });

            expect(lawService.suggestions).toHaveBeenCalledWith({ q: 'test', limit: 10 });
        });
    });

    describe('getRandom', () => {
        it('should return 200 with a random law', async () => {
            const law = { id: 42, text: 'Random Law', attributions: [] };
            lawService.getRandomLaw.mockResolvedValue(law);

            await lawController.getRandom(req, res);

            expect(lawService.getRandomLaw).toHaveBeenCalled();
            expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
            expect(res.end).toHaveBeenCalledWith(JSON.stringify(law));
        });

        it('should return 404 when no published laws exist', async () => {
            lawService.getRandomLaw.mockResolvedValue(undefined);

            await lawController.getRandom(req, res);

            expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
            expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: 'No published laws available' }));
        });
    });
});
