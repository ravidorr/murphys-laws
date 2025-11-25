import { sendJson } from '../utils/http-helpers.js';

export class CategoryController {
  constructor(categoryService) {
    this.categoryService = categoryService;
  }

  async list(req, res) {
    const categories = await this.categoryService.listCategories();
    return sendJson(res, 200, { data: categories }, req);
  }

  async get(req, res, id) {
    const category = await this.categoryService.getCategory(id);

    if (!category) {
      return sendJson(res, 404, { error: 'Category not found' }, req);
    }

    return sendJson(res, 200, category, req);
  }
}
