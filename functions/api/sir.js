const CORS = {
  'Access-Control-Allow-Origin': '*',
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

  let reporter, category, description, evidence, severity, passcode_id;
  try {
    const body = await request.json();
    reporter = typeof body.reporter === 'string' ? body.reporter.trim() : '';
    category = typeof body.category === 'string' ? body.category.trim() : '';
    description = typeof body.description === 'string' ? body.description.trim() : '';
    evidence = typeof body.evidence === 'string' ? body.evidence.trim() : '';
    severity = typeof body.severity === 'string' ? body.severity.trim() : 'Medium';
    passcode_id = typeof body.passcode_id === 'string' ? body.passcode_id.trim() : '';
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!reporter) return json({ error: 'reporter is required' }, 400);
  if (!category) return json({ error: 'category is required' }, 400);
  if (!description) return json({ error: 'description is required' }, 400);
  if (!['Low', 'Medium', 'High', 'Critical'].includes(severity)) {
    severity = 'Medium';
  }
  if (!passcode_id) return json({ error: 'passcode_id is required' }, 400);

  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS sir_reports (
          id          TEXT PRIMARY KEY,
          reporter    TEXT NOT NULL,
          category    TEXT NOT NULL,
          description TEXT NOT NULL,
          evidence    TEXT,
          severity    TEXT NOT NULL DEFAULT 'Medium',
          passcode_id TEXT NOT NULL,
          created_at  TEXT NOT NULL
        )`,
      )
      .run();

    try {
      await db.prepare('ALTER TABLE sir_reports ADD COLUMN passcode_id TEXT NOT NULL DEFAULT \'\'').run();
    } catch {
      /* column already exists */
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await db
      .prepare(
        'INSERT INTO sir_reports (id, reporter, category, description, evidence, severity, passcode_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(id, reporter, category, description, evidence || null, severity, passcode_id, createdAt)
      .run();

    return json({ success: true, id, passcode_id, created_at: createdAt });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
