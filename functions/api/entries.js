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

  let content, classNum, section;
  try {
    ({ content, class: classNum, section } = await request.json());
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

  const id        = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  try {
    await db
      .prepare(
        'INSERT INTO rag_entries (id, class_num, section, content, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(id, cls, sec, content.trim(), createdAt)
      .run();

    return json({ success: true, id, class: cls, section: sec, created_at: createdAt });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
