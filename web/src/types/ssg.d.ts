declare module '@scripts/ssg' {
  import type { Corollary, CorollaryParent } from './app.d.ts';

  export interface ContentPageMeta {
    slug: string;
    file: string;
    title: string;
    description: string;
  }

  export interface StaticLaw {
    id: number;
    title?: string;
    text?: string;
    attributions?: { name?: string; contact_type?: string; contact_value?: string; note?: string }[];
    attribution?: string;
    author?: string;
    category_slug?: string;
    category_name?: string;
    category_context?: string | null;
    corollary_of_id?: number | null;
    upvotes?: number;
    downvotes?: number;
    score?: number;
    created_at?: string;
    updated_at?: string;
    editorial?: {
      explanation: string;
      practical_example: string;
      source_label: string;
      source_url: string;
      reviewed_at: string;
    };
  }

  export interface PageMetadata {
    title: string;
    description: string;
    canonicalPath: string;
    type?: 'website' | 'article';
    image?: string;
    robots?: string;
  }

  export interface StaticCategory {
    slug: string;
    title: string;
    description?: string;
    law_count: number;
  }

  export const CONTENT_PAGES: ContentPageMeta[];
  export function wrapFirstWordWithAccent(text: string): string;
  export function enhanceMarkdownHtml(html: string): string;
  export function wrapInCardStructure(html: string, options?: { lastUpdated?: string }): string;
  export function injectBreadcrumbJsonLd(html: string, id: string, trail: Array<{ name: string; path: string }>): string;
  export function holdAppEntry(html: string): string;
  export function validateHomePage(html: string): string[];
  export function buildContentBreadcrumbTrail(page: { slug: string; title: string }): Array<{ name: string; path: string }>;
  export function buildStaticFavoritesContent(): string;
  export function buildStaticSubmitContent(): string;
  export function buildStaticCalculatorContent(kind: 'sods-law' | 'buttered-toast'): string;
  export function applyPageMetadata(html: string, metadata: PageMetadata): string;
  export interface StaticCorollaryContext {
    corollaries: Corollary[];
    parent: CorollaryParent | null;
  }
  export function generateLawPage(law: StaticLaw, template: string, relatedLaws?: StaticLaw[], seo?: { title: string; description: string; headline: string }, corollaryContext?: StaticCorollaryContext): string;
  export function buildCorollaryIndex(laws: StaticLaw[]): Map<number, StaticCorollaryContext>;
  export function buildSitemapXml(input: {
    baseUrl: string;
    laws: StaticLaw[];
    categories: StaticCategory[];
    contentPages: ContentPageMeta[];
    contentMetadata: Record<string, { lastUpdated?: string }>;
    staticRoutePaths: string[];
  }): string;
  export function validateGeneratedPage(html: string, options: {
    canonicalPath: string;
    description?: string;
    forbidContactDetails?: boolean;
    requireCategoryLink?: boolean;
    requireContentFigure?: boolean;
  }): string[];
  export function buildStaticLawDetailContent(law: StaticLaw, related?: StaticLaw[], corollaryContext?: StaticCorollaryContext): string;
  export function buildStaticArticleArchive(slug: string, laws: StaticLaw[]): { nextSteps: string; featuredLaws: string; submitAction: string };
  export function buildStaticHomeContent(featuredLaw?: StaticLaw): string;
  export function buildStaticCategoryContent(options: { slug: string; title: string; descriptionText: string; lawCardsSection: string; lawIndex: string }): string;
  export function buildStaticCategoriesContent(categories: StaticCategory[]): string;
  export function buildNotFoundPage(template: string, laws: StaticLaw[]): string;
  export function validateNotFoundPage(html: string): string[];
  export function fetchWithRetry(url: string, options?: {
    fetchImpl?: (url: string, init: { signal: AbortSignal }) => Promise<{
      ok: boolean;
      status: number;
      text(): Promise<string>;
    }>;
    timeoutMs?: number;
    retries?: number;
    retryDelayMs?: number;
    sleep?: (milliseconds: number) => Promise<void>;
  }): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
  export function fetchAllCategories(fetchRequest?: (url: string) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }>, baseUrl?: string): Promise<StaticCategory[]>;
  export function fetchAllLaws(fetchRequest?: (url: string) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }>, baseUrl?: string): Promise<StaticLaw[]>;
  export function mergeReviewedLawDetails(laws: StaticLaw[], fetchRequest?: (url: string) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }>, baseUrl?: string): Promise<StaticLaw[]>;
  export function fetchFirstPageOfLaws(params: { limit: number; offset?: number; category_id?: number; category_slug?: string }, fetchRequest?: (url: string) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }>, baseUrl?: string): Promise<{ data: StaticLaw[]; total: number }>;
  export function checkCategoryLawCounts(slug: string, firstPageTotal: number, categoryLawCount: number): void;
  export const REVIEWED_LAW_TITLES: string[];
  export function categorySitemapPaths(categories: StaticCategory[]): string[];
  export function pickRelatedLaws<T extends { id: number }>(law: T, categoryLaws: T[], count?: number): T[];
  export function pickRelatedStandaloneLaws<T extends { id: number; corollary_of_id?: number | null }>(law: T, categoryLaws: T[]): T[];
  export function relatedLawsForPage<T extends { id: number; category_slug?: string; corollary_of_id?: number | null }>(law: T, lawsByCategorySlug: Map<string, T[]>): T[];
  export function renderLawLinkList(
    laws: StaticLaw[],
    seoById: Map<string, { title: string; description: string; headline: string }>
  ): string;
}
