declare module '@scripts/ssg' {
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
    upvotes?: number;
    downvotes?: number;
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
  }

  export interface StaticCategory {
    slug: string;
    title: string;
    law_count: number;
  }

  export const CONTENT_PAGES: ContentPageMeta[];
  export function wrapFirstWordWithAccent(text: string): string;
  export function enhanceMarkdownHtml(html: string): string;
  export function wrapInCardStructure(html: string, options?: { lastUpdated?: string }): string;
  export function buildStaticFavoritesContent(): string;
  export function buildStaticSubmitContent(): string;
  export function buildStaticCalculatorContent(kind: 'sods-law' | 'buttered-toast'): string;
  export function applyPageMetadata(html: string, metadata: PageMetadata): string;
  export function validateGeneratedPage(html: string, options: {
    canonicalPath: string;
    forbidMailto?: boolean;
    requireCategoryLink?: boolean;
  }): string[];
  export function buildStaticLawDetailContent(law: StaticLaw, related?: StaticLaw[]): string;
  export function buildStaticHomeContent(): string;
  export function fetchAllCategories(fetchRequest?: (url: string) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }>): Promise<StaticCategory[]>;
  export function categorySitemapPaths(categories: StaticCategory[]): string[];
}
