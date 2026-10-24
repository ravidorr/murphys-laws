export const PAGE_SIZE: number;
export const STATUSES: { value: string; label: string }[];
export const STATUS_LABELS: Record<string, string>;

export interface AdminLawLike {
  status: string;
  title?: string | null;
  text: string;
  admin_notes?: string | null;
}

export function buildListUrl(params: { status: string; q: string; offset: number }): string;
export function buildUpdateBody(
  law: AdminLawLike,
  edits: { status?: string; title?: string; text?: string; notes?: string },
): Record<string, string | null>;
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
