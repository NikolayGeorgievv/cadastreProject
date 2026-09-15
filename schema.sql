-- D1 schema. Apply with:
--   wrangler d1 execute geolightsurvey --local  --file=./schema.sql
--   wrangler d1 execute geolightsurvey --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS requests (
  id          TEXT PRIMARY KEY,
  created_at  TEXT    NOT NULL,          -- ISO 8601, UTC
  name        TEXT    NOT NULL,
  phone       TEXT    NOT NULL,
  email       TEXT,
  service     TEXT    NOT NULL,          -- slug from validation.js
  location    TEXT    NOT NULL,
  identifier  TEXT,
  message     TEXT    NOT NULL,
  consent     INTEGER NOT NULL,          -- 0/1, evidence the box was ticked
  ip          TEXT,
  user_agent  TEXT,
  email_sent  INTEGER NOT NULL DEFAULT 0 -- 0 = stored but the notification failed
);

-- retention sweep and "what came in last month" both scan by date
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests (created_at);

-- finding the ones nobody was told about
CREATE INDEX IF NOT EXISTS idx_requests_unsent ON requests (email_sent) WHERE email_sent = 0;
