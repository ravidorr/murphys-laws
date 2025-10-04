// Voting utility with localStorage tracking and API integration

import { API_BASE_URL, API_FALLBACK_URL } from './constants.js';

const VOTES_KEY = 'murphy_votes';

// Get all votes from localStorage
function getVotesFromStorage() {
  try {
    const data = localStorage.getItem(VOTES_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// Save votes to localStorage
function saveVotesToStorage(votes) {
  try {
    localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
  } catch (err) {
    console.error('Failed to save votes to localStorage:', err);
  }
}

// Get user's vote for a specific law
export function getUserVote(lawId) {
  const votes = getVotesFromStorage();
  return votes[lawId] || null; // Returns 'up', 'down', or null
}

// Vote on a law (up or down)
export async function voteLaw(lawId, voteType) {
  if (!['up', 'down'].includes(voteType)) {
    throw new Error('voteType must be "up" or "down"');
  }

  const apiUrl = API_BASE_URL || '';
  const fallbackUrl = API_FALLBACK_URL || 'http://127.0.0.1:8787';
  const endpoint = `/api/laws/${lawId}/vote`;
  const primaryUrl = `${apiUrl}${endpoint}`;

  try {
    const response = await fetch(primaryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ vote_type: voteType })
    });

    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        errorMessage = `Failed to vote (error ${response.status})`;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();

    // Save to localStorage
    const votes = getVotesFromStorage();
    votes[lawId] = voteType;
    saveVotesToStorage(votes);

    return result;
  } catch (err) {
    // Try fallback URL
    console.error('Primary API failed, trying fallback:', err);

    const fallbackFullUrl = `${fallbackUrl}${endpoint}`;
    const fallbackResponse = await fetch(fallbackFullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ vote_type: voteType })
    });

    if (!fallbackResponse.ok) {
      let errorMessage;
      try {
        const errorData = await fallbackResponse.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        errorMessage = `Failed to vote (error ${fallbackResponse.status})`;
      }
      throw new Error(errorMessage);
    }

    const result = await fallbackResponse.json();

    // Save to localStorage
    const votes = getVotesFromStorage();
    votes[lawId] = voteType;
    saveVotesToStorage(votes);

    return result;
  }
}

// Remove vote from a law
export async function unvoteLaw(lawId) {
  const apiUrl = API_BASE_URL || '';
  const fallbackUrl = API_FALLBACK_URL || 'http://127.0.0.1:8787';
  const endpoint = `/api/laws/${lawId}/vote`;
  const primaryUrl = `${apiUrl}${endpoint}`;

  try {
    const response = await fetch(primaryUrl, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        errorMessage = `Failed to remove vote (error ${response.status})`;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();

    // Remove from localStorage
    const votes = getVotesFromStorage();
    delete votes[lawId];
    saveVotesToStorage(votes);

    return result;
  } catch (err) {
    // Try fallback URL
    console.error('Primary API failed, trying fallback:', err);

    const fallbackFullUrl = `${fallbackUrl}${endpoint}`;
    const fallbackResponse = await fetch(fallbackFullUrl, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!fallbackResponse.ok) {
      let errorMessage;
      try {
        const errorData = await fallbackResponse.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        errorMessage = `Failed to remove vote (error ${fallbackResponse.status})`;
      }
      throw new Error(errorMessage);
    }

    const result = await fallbackResponse.json();

    // Remove from localStorage
    const votes = getVotesFromStorage();
    delete votes[lawId];
    saveVotesToStorage(votes);

    return result;
  }
}

// Toggle vote (if same type clicked, remove; if different, change; if no vote, add)
export async function toggleVote(lawId, voteType) {
  const currentVote = getUserVote(lawId);

  if (currentVote === voteType) {
    // Same vote clicked - remove it
    return await unvoteLaw(lawId);
  } else {
    // Different vote or no vote - set new vote
    return await voteLaw(lawId, voteType);
  }
}
