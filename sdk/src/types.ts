export interface Attribution {
  name?: string;
  note?: string;
}

export interface LawEditorial {
  explanation: string;
  practical_example: string;
  source_label: string;
  source_url: string;
  reviewed_at: string;
}

export interface Law {
  id: number;
  title?: string | null;
  text: string;
  attributions?: Attribution[] | string;
  upvotes?: number;
  downvotes?: number;
  score?: number;
  category_id?: number;
  category_name?: string;
  category_slug?: string;
  similarity?: number;
  match_type?: 'exact' | 'fuzzy';
  editorial?: LawEditorial;
  [key: string]: unknown;
}

export interface LawsPage {
  data: Law[];
  total: number;
  limit: number;
  offset: number;
}

export interface LawOfDay {
  law: Law;
  featured_date: string;
}

export interface Category {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  law_count: number;
}

export interface CategoriesResponse {
  data: Category[];
}

export interface SearchLawsParams {
  q?: string;
  category_slug?: string;
  limit?: number;
  offset?: number;
  sort?: 'relevance' | 'score' | 'upvotes' | 'created_at' | 'last_voted_at' | 'id';
  order?: 'asc' | 'desc';
}

export interface SubmitLawInput {
  text: string;
  title?: string;
  author?: string;
  category_id?: number;
  category_slug?: string;
}

export interface SubmitLawSuccess {
  kind: 'success';
  ok: true;
  status: 201;
  data: {
    id: number;
    title: string;
    text: string;
    status: string;
    message: string;
  };
}

export interface SubmitLawRateLimited {
  kind: 'rate_limited';
  ok: false;
  status: 429;
  error: string;
  retryAfter: number;
}

export interface SubmitLawValidationError {
  kind: 'validation_error';
  ok: false;
  status: 400;
  error: string;
}

export interface SubmitLawUnexpectedError {
  kind: 'unexpected_error';
  ok: false;
  status: number;
  error: string;
}

export type SubmitLawResult =
  | SubmitLawSuccess
  | SubmitLawRateLimited
  | SubmitLawValidationError
  | SubmitLawUnexpectedError;
