-- Migration 021: Web Push subscriptions for the daily Law of the Day notification.
--
-- One row per browser subscription. `endpoint` is the push service URL the browser handed us, `p256dh` and
-- `auth` are the keys needed to encrypt a message for it. `last_sent_date` (UTC day) keeps the daily send
-- idempotent. A subscription the push service reports as gone (404 or 410) is deleted.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_sent_date TEXT
);
