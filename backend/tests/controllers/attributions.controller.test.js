import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AttributionController } from '../../src/controllers/attributions.controller.mjs';

describe('AttributionController', () => {
    let localThis;

    beforeEach(() => {
        localThis = {
            attributionService: {
                listAttributions: vi.fn(),
            },
            attributionController: null,
            req: {},
            res: {
                writeHead: vi.fn(),
                end: vi.fn(),
            },
        };
        localThis.attributionController = new AttributionController(localThis.attributionService);
    });

    it('should list attributions', async () => {
        localThis.attributionService.listAttributions.mockResolvedValue([{ name: 'Author A' }]);
        await localThis.attributionController.list(localThis.req, localThis.res);

        expect(localThis.attributionService.listAttributions).toHaveBeenCalled();
        expect(localThis.res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
        // Check that it maps objects to strings
        expect(localThis.res.end).toHaveBeenCalledWith(expect.stringContaining('["Author A"]'));
    });

    it('should filter out null attribution names', async () => {
        localThis.attributionService.listAttributions.mockResolvedValue([
            { name: null },
            { name: 'Valid Author' }
        ]);
        await localThis.attributionController.list(localThis.req, localThis.res);

        expect(localThis.res.end).toHaveBeenCalledWith(expect.stringContaining('["Valid Author"]'));
        expect(localThis.res.end).not.toHaveBeenCalledWith(expect.stringContaining('null'));
    });

    it('should filter out undefined attribution names', async () => {
        localThis.attributionService.listAttributions.mockResolvedValue([
            { name: undefined },
            { name: 'Valid' }
        ]);
        await localThis.attributionController.list(localThis.req, localThis.res);

        expect(localThis.res.end).toHaveBeenCalledWith(expect.stringContaining('["Valid"]'));
    });

    it('should filter out non-string attribution names', async () => {
        localThis.attributionService.listAttributions.mockResolvedValue([
            { name: 123 },
            { name: { nested: 'object' } },
            { name: 'Valid' }
        ]);
        await localThis.attributionController.list(localThis.req, localThis.res);

        expect(localThis.res.end).toHaveBeenCalledWith(expect.stringContaining('["Valid"]'));
    });

    it('should filter out empty and whitespace-only attribution names', async () => {
        localThis.attributionService.listAttributions.mockResolvedValue([
            { name: '' },
            { name: '   ' },
            { name: 'Valid' }
        ]);
        await localThis.attributionController.list(localThis.req, localThis.res);

        expect(localThis.res.end).toHaveBeenCalledWith(expect.stringContaining('["Valid"]'));
    });

    it('should filter out "undefined" and "null" string values', async () => {
        localThis.attributionService.listAttributions.mockResolvedValue([
            { name: 'undefined' },
            { name: 'NULL' },
            { name: 'null' },
            { name: 'UNDEFINED' },
            { name: 'Valid' }
        ]);
        await localThis.attributionController.list(localThis.req, localThis.res);

        expect(localThis.res.end).toHaveBeenCalledWith(expect.stringContaining('["Valid"]'));
    });
});
