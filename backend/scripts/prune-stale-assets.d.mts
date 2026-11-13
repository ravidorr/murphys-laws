export const DEFAULT_MAX_AGE_DAYS: number;
export const MIN_KEPT_FILES: number;
export const MAX_DELETE_FRACTION: number;

export interface RetentionPlan {
  dist: string;
  assets: string;
  total: number;
  totalBytes: number;
  referenced: number;
  requestedKept: number;
  kept: number;
  candidates: string[];
  candidateBytes: number;
}

export function requestedNames(logPaths: string[]): Set<string>;
export function namesIn(text: string, names: Set<string>): Set<string>;
export function entryAssets(indexHtml: string): { scripts: string[]; styles: string[] };
export function planDirectory(dist: string, options?: { now?: number; maxAgeDays?: number; requested?: Set<string> }): RetentionPlan;
export function run(
  argv: string[],
  options?: { log?: (line: string) => void; error?: (line: string) => void; now?: number },
): number;
