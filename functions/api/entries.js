/**
 * Cloudflare Pages Function - POST /api/entries
 * Requires D1 binding RAG_DB and stores entries per class (1-12) + section (A-Z).
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const db = env.RAG_DB;
  if (!db) return json({ error: 'D1 binding RAG_DB not configured' }, 500);

  let content, classNum, section, passcode_id;
  try {
    const body = await request.json();
    content = body.content;
    classNum = body.class;
    section = body.section;
    passcode_id = typeof body.passcode_id === 'string' ? body.passcode_id.trim() : '';
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return json({ error: 'content is required' }, 400);
  }

  const cls = Number(classNum);
  if (!Number.isInteger(cls) || cls < 1 || cls > 12) {
    return json({ error: 'class must be an integer from 1 to 12' }, 400);
  }

  const sec = String(section || '').trim().toUpperCase();
  if (!/^[A-Z]$/.test(sec)) {
    return json({ error: 'section must be a single letter A-Z' }, 400);
  }

  if (!passcode_id) {
    return json({ error: 'passcode_id is required' }, 400);
  }

  try {
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS rag_entries (
        id          TEXT PRIMARY KEY,
        class_num   INTEGER NOT NULL CHECK (class_num BETWEEN 1 AND 12),
        section     TEXT    NOT NULL CHECK (section GLOB '[A-Z]'),
        content     TEXT    NOT NULL,
        passcode_id TEXT    NOT NULL,
        created_at  TEXT    NOT NULL
      )`,
    ).run();
  } catch {
    /* table already exists */
  }

  try {
    await db.prepare('ALTER TABLE rag_entries ADD COLUMN passcode_id TEXT NOT NULL DEFAULT \'\'').run();
  } catch {
    /* column already exists */
  }

  const id        = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  try {
    await db
      .prepare(
        'INSERT INTO rag_entries (id, class_num, section, content, passcode_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(id, cls, sec, content.trim(), passcode_id, createdAt)
      .run();

    return json({ success: true, id, class: cls, section: sec, passcode_id, created_at: createdAt });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
