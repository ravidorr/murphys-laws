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
  /** Single-law reads only: the published corollaries of this law, in the order they were linked (the original bullet order for imported laws). */
  corollaries?: Corollary[];
  /** Single-law reads only: the published law this one is a corollary of, or null. */
  corollary_of?: CorollaryParent | null;
  /** List rows only: id of the published law this one is a corollary of, or null. */
  corollary_of_id?: number | null;
  [key: string]: unknown;
}

/** A corollary listed under its parent law. */
export interface Corollary {
  id: number;
  title: string | null;
  text: string;
  upvotes: number;
  downvotes: number;
}

/** The law a corollary belongs to. */
export interface CorollaryParent {
  id: number;
  title: string | null;
  text: string;
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

/** A consequence that follows from the submitted law. It becomes a law of its own once published. */
export interface SubmitLawCorollaryInput {
  /** Up to 200 characters. */
  title?: string;
  /** 10-1000 characters. */
  text: string;
}

export interface SubmitLawInput {
  text: string;
  title?: string;
  author?: string;
  category_id?: number;
  category_slug?: string;
  /** Up to 5. They are reviewed and published together with the law, and share its category. */
  corollaries?: SubmitLawCorollaryInput[];
}

export interface SubmittedCorollary {
  id: number;
  title: string | null;
  text: string;
}

export interface SubmitLawSuccess {
  kind: 'success';
  ok: true;
  status: 201;
  data: {
    id: number;
    title: string | null;
    text: string;
    status: string;
    /** The corollaries created with the law; empty when none were submitted. */
    corollaries: SubmittedCorollary[];
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
