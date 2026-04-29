import { sendJson } from '../utils/http-helpers.ts';

function parseLimit(value: unknown, fallback = 6): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(10, Math.trunc(parsed)));
}

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

  async related(req: any, res: any, slug: string, parsed: any = { query: {} }) {
    const limit = parseLimit(parsed.query?.limit, 6);
    const related = await this.categoryService.getRelatedCategories(slug, { limit });
    return sendJson(res, 200, { data: related, category_slug: slug }, req);
  }
}
