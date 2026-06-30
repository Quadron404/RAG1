export const DEFAULT_PASSCODE = 'RAG2718';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function ensurePasscodesTable(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS passcodes (
        passcode_id             TEXT PRIMARY KEY,
        status                  TEXT NOT NULL DEFAULT 'Unused'
                                CHECK (status IN ('Unused', 'Used', 'Flagged')),
        webauthn_credential_id  TEXT UNIQUE,
        public_key              TEXT,
        CHECK (
          status = 'Unused'
          OR (webauthn_credential_id IS NOT NULL AND public_key IS NOT NULL)
        )
      )`,
    )
    .run();

  await db
    .prepare('CREATE INDEX IF NOT EXISTS idx_passcodes_status ON passcodes (status)')
    .run();

  const existing = await db
    .prepare('SELECT COUNT(*) AS count FROM passcodes')
    .first();

  if (!existing?.count) {
    await db
      .prepare("INSERT INTO passcodes (passcode_id, status) VALUES (?, 'Unused')")
      .bind(DEFAULT_PASSCODE)
      .run();
  }
}
