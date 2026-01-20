import { sendJson } from '../utils/http-helpers.js';

export class AttributionController {
  constructor(attributionService) {
    this.attributionService = attributionService;
  }

  async list(req, res) {
    const attributions = await this.attributionService.listAttributions();
    // Map to simple array of strings, filtering out invalid values
    const names = attributions
      .map(a => a.name)
      .filter(name => {
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
