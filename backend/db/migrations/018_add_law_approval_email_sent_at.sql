-- Migration 018: remember when the submitter was thanked for an approved law, so moving a law
-- back to review and approving it again does not send a second email.

ALTER TABLE laws ADD COLUMN approval_email_sent_at TEXT;
