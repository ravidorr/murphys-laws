import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AttributionController } from '../../src/controllers/attributions.controller.mjs';

describe('AttributionController', () => {
    let attributionService;
    let attributionController;
    let req;
    let res;

    beforeEach(() => {
        attributionService = {
            listAttributions: vi.fn(),
        };
        attributionController = new AttributionController(attributionService);

        req = {};
        res = {
            writeHead: vi.fn(),
            end: vi.fn(),
        };
    });

    it('should list attributions', async () => {
        attributionService.listAttributions.mockResolvedValue([{ name: 'Author A' }]);
        await attributionController.list(req, res);

        expect(attributionService.listAttributions).toHaveBeenCalled();
        expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
        // Check that it maps objects to strings
        expect(res.end).toHaveBeenCalledWith(expect.stringContaining('["Author A"]'));
    });
});
