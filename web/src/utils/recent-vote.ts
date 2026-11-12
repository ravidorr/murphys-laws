// Remembers when this browser last cast or removed a vote, so the Law of the Day is not read from the HTTP cache
// right afterwards. GET /api/v1/law-of-day is cacheable for up to a minute, and a cached copy can predate the vote:
// the home card would then show a count without the visitor's own vote next to a voted highlight.
// The inline script in index.html reads the same key (ES5, before the bundle loads); keep the two in step, and the
// window in step with the API's `max-age` cap (LAW_OF_DAY_MAX_AGE_SECONDS in backend/src/controllers/laws.controller.ts).

export const LAST_VOTE_AT_KEY = 'murphy_last_vote_at';

/** The longest the API lets a cache reuse the Law of the Day (its `Cache-Control: max-age`) */
export const LAW_OF_DAY_CACHE_WINDOW_MS = 60_000;

/** Records that a vote was just cast or removed. Storage errors are ignored: the cache then just ages out. */
export function markVoteCast(): void {
  try {
    localStorage.setItem(LAST_VOTE_AT_KEY, String(Date.now()));
  } catch {
    // localStorage may be unavailable (private mode, quota); the vote itself is stored the same way
  }
}

/** The time of the last vote, or null if there is none or the stored value is unusable (not a time, or far ahead of the clock) */
function readLastVoteAt(): number | null {
  try {
    const at = Number(localStorage.getItem(LAST_VOTE_AT_KEY));
    return Number.isFinite(at) && at > 0 && at - Date.now() < LAW_OF_DAY_CACHE_WINDOW_MS ? at : null;
  } catch {
    return null;
  }
}

/**
 * True while a Law of the Day response cached before the last vote could still be fresh, so the next request
 * must go to the network. `Math.abs` tolerates a clock that moved a little since the vote.
 */
export function votedWithinCacheWindow(): boolean {
  const at = readLastVoteAt();
  return at !== null && Math.abs(Date.now() - at) < LAW_OF_DAY_CACHE_WINDOW_MS;
}

/** True if a vote was cast or removed at or after `time` (ms), i.e. a response fetched at `time` predates it */
export function votedSince(time: number): boolean {
  const at = readLastVoteAt();
  return at !== null && at >= time;
}
