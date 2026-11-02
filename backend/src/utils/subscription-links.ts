import { SITE_URL } from './constants.ts';

/** Link in the confirmation email. */
export function confirmUrl(token: string): string {
  return `${SITE_URL}/subscription/confirm?token=${token}`;
}

/** Link in every daily email (also the target of the one-click List-Unsubscribe request). */
export function unsubscribeUrl(token: string): string {
  return `${SITE_URL}/subscription/unsubscribe?token=${token}`;
}
