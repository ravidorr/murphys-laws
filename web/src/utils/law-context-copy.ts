/**
 * Fallback "In context" copy for law detail pages when the primary category
 * has no law_context in the database. Category-specific copy is stored in
 * categories.law_context and returned with the law API as category_context.
 */

const DEFAULT_LAW_CONTEXT =
  "Laws in this collection capture the same spirit as Murphy's original observation: when something can go wrong, it often will. They remind us to plan for failure, stay humble, and keep a sense of humor when the universe has other plans.";

/**
 * Returns the default editorial copy used when a law's primary category
 * has no law_context set in the database.
 */
export function getDefaultLawContext(): string {
  return DEFAULT_LAW_CONTEXT;
}
