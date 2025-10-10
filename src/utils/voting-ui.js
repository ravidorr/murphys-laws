// Voting UI utilities - handles vote button interactions and UI updates

import { toggleVote, getUserVote } from './voting.js';

/**
 * Adds voting event listeners to an element containing vote buttons
 * Handles clicks on vote buttons, updates vote counts and visual states
 * @param {HTMLElement} el - Container element with vote buttons
 */
export function addVotingListeners(el) {
  el.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    // Handle vote buttons
    const voteBtn = t.closest('[data-vote]');
    if (voteBtn) {
      e.stopPropagation();
      const voteType = voteBtn.getAttribute('data-vote');
      const lawId = voteBtn.getAttribute('data-law-id');

      if (!lawId) return;

      try {
        const result = await toggleVote(lawId, voteType);

        // Update vote counts in UI
        const lawCard = voteBtn.closest('.law-card-mini');
        if (lawCard) {
          const upBtn = lawCard.querySelector('[data-vote="up"]');
          const downBtn = lawCard.querySelector('[data-vote="down"]');
          const upCount = upBtn?.querySelector('.count-num');
          const downCount = downBtn?.querySelector('.count-num');

          if (upCount) upCount.textContent = result.upvotes;
          if (downCount) downCount.textContent = result.downvotes;

          // Update active state
          const newUserVote = getUserVote(lawId);
          upBtn?.classList.toggle('voted', newUserVote === 'up');
          downBtn?.classList.toggle('voted', newUserVote === 'down');
        }
      } catch (error) {
        console.error('Failed to vote:', error);
        // Could add a notification here if needed
      }
      return;
    }
  });
}
