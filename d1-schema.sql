-- Run once on your D1 database:
-- wrangler d1 execute rag-genesis-db --remote --file=d1-schema.sql

CREATE TABLE IF NOT EXISTS rag_entries (
  id         TEXT    PRIMARY KEY,
  class_num  INTEGER NOT NULL CHECK (class_num BETWEEN 1 AND 12),
  section    TEXT    NOT NULL CHECK (section GLOB '[A-Z]'),
  content    TEXT    NOT NULL,
  created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_class_section
  ON rag_entries (class_num, section);

CREATE TABLE IF NOT EXISTS passcodes (
  passcode_id             TEXT PRIMARY KEY,
  status                  TEXT NOT NULL DEFAULT 'Unused'
                          CHECK (status IN ('Unused', 'Used', 'Flagged',
                                            'Compromised')),
  webauthn_credential_id  TEXT UNIQUE,
  public_key              TEXT,
  CHECK (
    status = 'Unused'
    OR (webauthn_credential_id IS NOT NULL AND public_key IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_passcodes_status
  ON passcodes (status);

CREATE TABLE IF NOT EXISTS sir_reports (
  id          TEXT PRIMARY KEY,
  reporter    TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence    TEXT,
  severity    TEXT NOT NULL DEFAULT 'Medium'
              CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sir_created
  ON sir_reports (created_at);
