/** A law record returned by the API */
export interface Law {
  id: number;
  text: string;
  title?: string;
  attribution?: string;
  category_id?: number | null;
  category_ids?: number[];
  category_slug?: string;
  category_name?: string;
  slug?: string;
  upvotes?: number;
  downvotes?: number;
  score?: number;
  created_at?: string;
  updated_at?: string;
  author?: string;
  attributions?: Attribution[];
  submittedBy?: string;
  last_voted_at?: string;
}

/** Attribution payload returned by the API */
export interface Attribution {
  name?: string | null;
  contact_type?: 'email' | 'url' | 'text' | null;
  contact_value?: string | null;
  note?: string | null;
}

/** A category record returned by the API */
export interface Category {
  id: number;
  title: string;
  name?: string;
  slug: string;
  description?: string;
  law_count?: number;
}

/** An HTMLElement with an optional cleanup method, used by components */
export interface CleanableElement extends HTMLElement {
  cleanup?: () => void;
}

/** Route information parsed from the current URL */
export interface RouteInfo {
  name: string;
  param: string | null;
}

/** Navigation callback signature */
export type OnNavigate = (page: string, param?: string) => void;

/** Paginated API response */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Non-paginated list response */
export interface ListResponse<T> {
  data: T[];
}

/** Related-laws response from the API */
export interface RelatedLawsResponse {
  data: Law[];
  law_id: number;
}

/** Vote response from the API */
export interface VoteResponse {
  upvotes: number;
  downvotes: number;
}

/** Vote type */
export type VoteType = 'up' | 'down';

/** Theme preference */
export type Theme = 'light' | 'dark' | 'auto';

/** Effective (resolved) theme */
export type EffectiveTheme = 'light' | 'dark';

/** Feature flag definition */
export interface FeatureFlagDef {
  envKey: string;
  default: boolean;
  storageKey: string;
}

/** Feature state info (for debugging) */
export interface FeatureState {
  enabled: boolean;
  source: 'localStorage' | 'environment' | 'default' | 'unknown';
}

/** Search filters object */
export interface SearchFilters {
  q?: string;
  category_id?: string | number;
  attribution?: string;
}

/** Favorite law stored in localStorage */
export interface FavoriteLaw {
  /** number | string because DOM getAttribute() returns strings, while API returns numbers */
  id: number | string;
  text: string;
  title: string;
  attribution?: string;
  category_id?: number;
  category_slug?: string;
  savedAt: number;
}

/** Route render function signature */
export type RouteRenderFn = (context: { param?: string | null }) => HTMLElement;
