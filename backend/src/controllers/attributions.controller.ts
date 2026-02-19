import { sendJson } from '../utils/http-helpers.ts';

export class AttributionController {
  attributionService: any;

  constructor(attributionService: any) {
    this.attributionService = attributionService;
  }

  async list(req: any, res: any) {
    const attributions = await this.attributionService.listAttributions();
    // Map to simple array of strings, filtering out invalid values
    const names = attributions
      .map((a: any) => a.name)
      .filter((name: any) => {
        // Filter out null, undefined, empty strings, and problematic values
        if (name === null || name === undefined) return false;
        if (typeof name !== 'string') return false;
        const trimmed = name.trim();
        if (!trimmed) return false;
        if (trimmed.toLowerCase() === 'undefined') return false;
        if (trimmed.toLowerCase() === 'null') return false;
        return true;
      });
    return sendJson(res, 200, { data: names }, req);
  }
}
