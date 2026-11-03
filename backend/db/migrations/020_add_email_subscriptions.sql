-- Migration 020: daily Law of the Day email subscriptions.
--
-- Double opt-in: a row starts as 'pending' and only becomes 'confirmed' when the owner of the address opens
-- the link in the confirmation email. `token` is the secret behind both the confirm and unsubscribe links.
-- `last_sent_date` (UTC day) keeps the daily send idempotent, so re-running the job never mails anyone twice.

CREATE TABLE IF NOT EXISTS email_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  confirmation_sent_at DATETIME,
  confirmed_at DATETIME,
  unsubscribed_at DATETIME,
  last_sent_date TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_subscriptions_status ON email_subscriptions(status);
