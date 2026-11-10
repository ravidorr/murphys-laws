export const PAGE_SIZE: number;
export const STATUSES: { value: string; label: string }[];
export const STATUS_LABELS: Record<string, string>;

export interface AdminLawLike {
  status: string;
  title?: string | null;
  text: string;
  admin_notes?: string | null;
  categories?: { id: number; name: string }[];
}

export function buildListUrl(params: { status: string; q: string; offset: number }): string;
export function buildUpdateBody(
  law: AdminLawLike,
  edits: { status?: string; title?: string; text?: string; notes?: string; categoryId?: number },
): Record<string, string | number | null>;
export function categorySelectValue(law: AdminLawLike): string;
export function pageLabel(total: number, offset: number, count: number): string;
export function formatDate(iso: string): string;
export function describeSubmitter(
  attributions: { name?: string | null; contact_type?: string | null; contact_value?: string | null }[] | undefined,
): string;
export function errorMessage(status: number, fallback?: string): string;
export function applyStatusChange(
  state: { counts: Record<string, number>; total: number; filter: string },
  from: string,
  to: string | null,
): { counts: Record<string, number>; total: number; removed: boolean };
export function isListReply(data: unknown): boolean;
export function isLawReply(data: unknown): boolean;
export function describeThankYou(thankYou: { status: string; reason?: string } | null | undefined): string;

export const MAX_COROLLARIES: number;
export const TREAT_OPTIONS: { value: string; label: string }[];
export interface SplitRow {
  title: string;
  text: string;
  treatAs: string;
  manual?: boolean;
}
export interface SplitCandidates {
  parent_text: string;
  items: { title: string | null; text: string; labeled: boolean }[];
}
export function countCorollaries(rows: SplitRow[]): number;
export function canAddCorollary(rows: SplitRow[]): boolean;
export function seedSplitRows(candidates: SplitCandidates): SplitRow[];
export function composeParentText(parentText: string, rows: SplitRow[]): string;
export function describeCandidates(candidates: SplitCandidates): string;
export function describeSplit(corollaries: number): { button: string; summary: string };
export function validateSplit(split: { parentText: string; rows: SplitRow[] }): string[];
export function buildSplitBody(
  law: AdminLawLike & { updated_at?: string },
  edits: { title?: string; notes?: string; categoryId?: number; parentText: string; rows: SplitRow[] },
): Record<string, unknown>;
