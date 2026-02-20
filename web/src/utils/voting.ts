// Voting utility with localStorage tracking and API integration
// Refactored to use generic API request helper (eliminates ~120 lines of duplicate code)

import { apiPost, apiDelete } from './request.ts';
import type { VoteType, VoteResponse } from '../types/app.d.ts';

const VOTES_KEY = 'murphy_votes';

// Get all votes from localStorage
function getVotesFromStorage(): Record<string, VoteType> {
  try {
    const data = localStorage.getItem(VOTES_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// Save votes to localStorage
function saveVotesToStorage(votes: Record<string, VoteType>): void {
  try {
    localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
  } catch {
    // Silently handle localStorage errors
  }
}

// Get user's vote for a specific law
export function getUserVote(lawId: string | number): VoteType | null {
  const votes = getVotesFromStorage();
  return votes[lawId] || null; // Returns 'up', 'down', or null
}

/**
 * Vote on a law (up or down)
 * @param {number|string} lawId - Law ID
 * @param {string} voteType - 'up' or 'down'
 * @returns {Promise<Object>} Response with upvotes and downvotes
 * @throws {Error} If vote fails
 */
export async function voteLaw(lawId: string | number, voteType: VoteType): Promise<VoteResponse> {
  if (!['up', 'down'].includes(voteType)) {
    throw new Error('voteType must be "up" or "down"');
  }

  const endpoint = `/api/v1/laws/${lawId}/vote`;

  // Use generic API request helper - eliminates duplicate fetch logic
  const result = await apiPost(endpoint, { vote_type: voteType }) as VoteResponse;

  // Save to localStorage
  const votes = getVotesFromStorage();
  votes[lawId] = voteType;
  saveVotesToStorage(votes);

  return result;
}

/**
 * Remove vote from a law
 * @param {number|string} lawId - Law ID
 * @returns {Promise<Object>} Response with upvotes and downvotes
 * @throws {Error} If unvote fails
 */
export async function unvoteLaw(lawId: string | number): Promise<VoteResponse> {
  const endpoint = `/api/v1/laws/${lawId}/vote`;

  // Use generic API request helper - eliminates duplicate fetch logic
  const result = await apiDelete(endpoint) as VoteResponse;

  // Remove from localStorage
  const votes = getVotesFromStorage();
  delete votes[lawId];
  saveVotesToStorage(votes);

  return result;
}

/**
 * Toggle vote (if same type clicked, remove; if different, change; if no vote, add)
 * @param {number|string} lawId - Law ID
 * @param {string} voteType - 'up' or 'down'
 * @returns {Promise<Object>} Response with upvotes and downvotes
 * @throws {Error} If toggle fails
 */
export async function toggleVote(lawId: string | number, voteType: VoteType): Promise<VoteResponse> {
  const currentVote = getUserVote(lawId);

  if (currentVote === voteType) {
    // Same vote clicked - remove it
    return await unvoteLaw(lawId);
  } else {
    // Different vote or no vote - set new vote
    return await voteLaw(lawId, voteType);
  }
}

/**
 * Adds voting event listeners to an element containing vote buttons
 * Handles clicks on vote buttons, updates vote counts and visual states
 * @param {HTMLElement} el - Container element with vote buttons
 */
export function addVotingListeners(el: HTMLElement): void {
  el.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    // Handle vote buttons
    const voteBtn = t.closest('[data-vote]');
    if (voteBtn) {
      e.stopPropagation();
      const voteType = voteBtn.getAttribute('data-vote') as VoteType | null;
      const lawId = voteBtn.getAttribute('data-law-id');

      if (!lawId || !voteType) return;

      try {
        const result = await toggleVote(lawId, voteType);

        // Update vote counts in UI
        const lawCard = voteBtn.closest('.law-card-mini');
        if (lawCard) {
          const upBtn = lawCard.querySelector('[data-vote="up"]');
          const downBtn = lawCard.querySelector('[data-vote="down"]');
          const upCount = upBtn?.querySelector('.count-num');
          const downCount = downBtn?.querySelector('.count-num');

          /* v8 ignore next - Vote count elements always present in law cards */
          if (upCount) upCount.textContent = String(result.upvotes);
          /* v8 ignore next - Vote count elements always present in law cards */
          if (downCount) downCount.textContent = String(result.downvotes);

          // Update active state
          const newUserVote = getUserVote(lawId);
          upBtn?.classList.toggle('voted', newUserVote === 'up');
          downBtn?.classList.toggle('voted', newUserVote === 'down');
        }
      } catch {
        // Silently handle voting errors
      }
      return;
    }
  });
}
