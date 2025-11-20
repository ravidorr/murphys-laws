import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthController } from '../../src/controllers/health.controller.mjs';

describe('HealthController', () => {
    let db;
    let healthController;
    let req;
    let res;

    beforeEach(() => {
        db = {
            prepare: vi.fn(),
        };
        healthController = new HealthController(db);

        req = {};
        res = {
            writeHead: vi.fn(),
            end: vi.fn(),
        };
    });

    it('should return 200 if db is healthy', async () => {
        db.prepare.mockReturnValue({ get: vi.fn() });
        await healthController.check(req, res);

        expect(db.prepare).toHaveBeenCalled();
        expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('should return 503 if db fails', async () => {
        db.prepare.mockImplementation(() => { throw new Error('DB Error'); });
        await healthController.check(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(503, expect.any(Object));
    });
});
