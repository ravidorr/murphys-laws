declare module '@scripts/ssg' {
  export function wrapFirstWordWithAccent(text: string): string;
  export function enhanceMarkdownHtml(html: string): string;
  export function wrapInCardStructure(html: string, options?: { lastUpdated?: string }): string;
}
