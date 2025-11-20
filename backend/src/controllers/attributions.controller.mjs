import { sendJson } from '../utils/http-helpers.js';

export class AttributionController {
  constructor(attributionService) {
    this.attributionService = attributionService;
  }

  async list(req, res) {
    const attributions = await this.attributionService.listAttributions();
    // Map to simple array of strings as per original API
    const names = attributions.map(a => a.name);
    return sendJson(res, 200, { data: names }, req);
  }
}
