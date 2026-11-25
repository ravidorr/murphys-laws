-- Migration 025: stop the signup form being used to mail strangers.
--
-- Bots submit the public daily-email form with other people's addresses, so the double opt-in confirmation
-- email is itself the spam (five of those recipients reported it to the mail provider in one week).
--
-- `confirmation_count` is how many confirmation emails the address was sent in the current window: the service
-- allows two, then makes the address wait 14 days from the last one, whatever the requests looked like, and
-- resets the count on confirmation.
-- Rows that already got a confirmation count as one.
--
-- `email_suppressions` is an address that must never be mailed again (a spam report, a hard bounce). It is a
-- separate table, not a status, so deleting or purging a subscription row cannot lift it, and the CHECK
-- constraint on email_subscriptions.status does not have to change.

ALTER TABLE email_subscriptions ADD COLUMN confirmation_count INTEGER NOT NULL DEFAULT 0;

UPDATE email_subscriptions SET confirmation_count = 1 WHERE confirmation_sent_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_suppressions (
  email TEXT NOT NULL PRIMARY KEY COLLATE NOCASE,
  reason TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
