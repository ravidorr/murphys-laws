import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CategoryController } from '../../src/controllers/categories.controller.ts';

describe('CategoryController', () => {
    let categoryService: { listCategories: ReturnType<typeof vi.fn>; getCategory: ReturnType<typeof vi.fn> };
    let categoryController: CategoryController;
    let req: IncomingMessage;
    let res: ServerResponse;

    beforeEach(() => {
        categoryService = {
            listCategories: vi.fn(),
            getCategory: vi.fn(),
        };
        categoryController = new CategoryController(categoryService as never);

        req = {} as IncomingMessage;
        res = {
            writeHead: vi.fn(),
            end: vi.fn(),
        } as unknown as ServerResponse;
    });

    it('should list categories', async () => {
        categoryService.listCategories.mockResolvedValue([]);
        await categoryController.list(req, res);

        expect(categoryService.listCategories).toHaveBeenCalled();
        expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('should get category by id', async () => {
        categoryService.getCategory.mockResolvedValue({ id: 1, title: 'Tech' });
        await categoryController.get(req, res, 1);

        expect(categoryService.getCategory).toHaveBeenCalledWith(1);
        expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('should return 404 if category not found', async () => {
        categoryService.getCategory.mockResolvedValue(null);
        await categoryController.get(req, res, 999);

        expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });
});
