import { ApiError } from './errors.js';
import type {
  CategoriesResponse,
  Category,
  Law,
  LawOfDay,
  LawsPage,
  SearchLawsParams,
  SubmitLawInput,
  SubmitLawResult,
} from './types.js';

export const DEFAULT_BASE_URL = 'https://murphys-laws.com';
export const DEFAULT_USER_AGENT = 'murphys-laws-sdk';

export type FetchLike = typeof fetch;

export interface MurphysLawsClientOptions {
  baseUrl?: string;
  fetch?: FetchLike;
  userAgent?: string;
}

export class MurphysLawsClient {
  readonly baseUrl: string;
  readonly userAgent: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: MurphysLawsClientOptions = {}) {
    this.baseUrl = stripTrailingSlash(options.baseUrl ?? DEFAULT_BASE_URL);
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new ApiError(res.status, await res.text());
    }
    return (await res.json()) as T;
  }

  async post<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': this.userAgent,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as T;
    return { status: res.status, data };
  }

  async searchLaws(params: SearchLawsParams): Promise<LawsPage> {
    const search = new URLSearchParams();
    if (params.q !== undefined) search.set('q', params.q);
    if (params.category_slug !== undefined) search.set('category_slug', params.category_slug);
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    if (params.offset !== undefined) search.set('offset', String(params.offset));
    if (params.sort !== undefined) search.set('sort', params.sort);
    if (params.order !== undefined) search.set('order', params.order);
    const qs = search.toString();
    return this.get<LawsPage>(`/api/v1/laws${qs ? `?${qs}` : ''}`);
  }

  getRandomLaw(): Promise<Law> {
    return this.get<Law>('/api/v1/laws/random');
  }

  getLawOfTheDay(): Promise<LawOfDay> {
    return this.get<LawOfDay>('/api/v1/law-of-day');
  }

  getLaw(id: number | string): Promise<Law> {
    return this.get<Law>(`/api/v1/laws/${encodeURIComponent(String(id))}`);
  }

  async listCategories(): Promise<Category[]> {
    const result = await this.get<CategoriesResponse>('/api/v1/categories');
    return result.data;
  }

  getLawsByCategory(
    categorySlug: string,
    params: Omit<SearchLawsParams, 'category_slug'> = {},
  ): Promise<LawsPage> {
    return this.searchLaws({ ...params, category_slug: categorySlug });
  }

  async submitLaw(input: SubmitLawInput): Promise<SubmitLawResult> {
    let categoryId = input.category_id;

    if (input.category_slug && categoryId === undefined) {
      const categories = await this.listCategories();
      const match = categories.find((c) => c.slug === input.category_slug);
      if (!match) {
        return {
          kind: 'validation_error',
          ok: false,
          status: 400,
          error: `Category "${input.category_slug}" not found.`,
        };
      }
      categoryId = match.id;
    }

    const body: Record<string, unknown> = { text: input.text };
    if (input.title !== undefined) body.title = input.title;
    if (input.author !== undefined) body.author = input.author;
    if (categoryId !== undefined) body.category_id = categoryId;

    const { status, data } = await this.post<Record<string, unknown>>('/api/v1/laws', body);

    if (status === 201) {
      return {
        kind: 'success',
        ok: true,
        status: 201,
        data: data as SubmitLawSuccessData,
      };
    }

    if (status === 429) {
      const retryAfter = typeof data.retryAfter === 'number' ? data.retryAfter : 60;
      return {
        kind: 'rate_limited',
        ok: false,
        status: 429,
        error: typeof data.error === 'string' ? data.error : 'Rate limit exceeded.',
        retryAfter,
      };
    }

    if (status === 400) {
      return {
        kind: 'validation_error',
        ok: false,
        status: 400,
        error: typeof data.error === 'string' ? data.error : 'Validation error.',
      };
    }

    return {
      kind: 'unexpected_error',
      ok: false,
      status,
      error: typeof data.error === 'string' ? data.error : `Unexpected response (status ${status}).`,
    };
  }
}

type SubmitLawSuccessData = {
  id: number;
  title: string;
  text: string;
  status: string;
  message: string;
};

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
