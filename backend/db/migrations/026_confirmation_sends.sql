-- Migration 026: a record of every confirmation email the signup tried to send.
--
-- The daily report counts the confirmation emails sent per day to judge whether bots are getting past the signup
-- checks. email_subscriptions.confirmation_sent_at cannot answer that: a later resend overwrites it, and a failed
-- send also stamps it. One row per attempt fixes both. No address is stored, only when and whether it worked.

CREATE TABLE IF NOT EXISTS confirmation_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ok INTEGER NOT NULL CHECK (ok IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_confirmation_sends_sent_at ON confirmation_sends(sent_at);
