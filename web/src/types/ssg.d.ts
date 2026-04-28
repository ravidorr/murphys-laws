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
  }

  export const CONTENT_PAGES: ContentPageMeta[];
  export function wrapFirstWordWithAccent(text: string): string;
  export function enhanceMarkdownHtml(html: string): string;
  export function wrapInCardStructure(html: string, options?: { lastUpdated?: string }): string;
  export function buildStaticFavoritesContent(): string;
  export function buildStaticSubmitContent(): string;
  export function buildStaticCalculatorContent(kind: 'sods-law' | 'buttered-toast'): string;
  export function buildStaticLawDetailContent(law: StaticLaw): string;
  export function buildStaticHomeContent(): string;
}
