import { sendJson } from '../utils/http-helpers.ts';

export class CategoryController {
  categoryService: any;

  constructor(categoryService: any) {
    this.categoryService = categoryService;
  }

  async list(req: any, res: any) {
    const categories = await this.categoryService.listCategories();
    return sendJson(res, 200, { data: categories }, req);
  }

  async get(req: any, res: any, id: number) {
    const category = await this.categoryService.getCategory(id);

    if (!category) {
      return sendJson(res, 404, { error: 'Category not found' }, req);
    }

    return sendJson(res, 200, category, req);
  }
}
