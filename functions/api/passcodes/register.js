import { CORS, cleanString, ensurePasscodesTable, json } from './_shared.js';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const db = env.RAG_DB;
  if (!db) return json({ error: 'D1 binding RAG_DB not configured' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const passcodeId = cleanString(body.passcode_id);
  const credentialId = cleanString(body.webauthn_credential_id);
  const publicKey = cleanString(body.public_key);

  if (!passcodeId) return json({ error: 'passcode_id is required' }, 400);
  if (!credentialId) return json({ error: 'webauthn_credential_id is required' }, 400);
  if (!publicKey) return json({ error: 'public_key is required' }, 400);

  let valid = false;
  for (let i = 1; i <= 500; i++) {
    const key = `passcode${i}`;
    if (env[key] === passcodeId) {
      valid = true;
      break;
    }
  }
  if (!valid) return json({ error: 'Unknown passcode' }, 404);

  try {
    await ensurePasscodesTable(db);

    const existing = await db
      .prepare('SELECT status FROM passcodes WHERE passcode_id = ?')
      .bind(passcodeId)
      .first();

    if (existing && (existing.status === 'Flagged' || existing.status === 'Compromised')) {
      return json({ error: 'Passcode is permanently denied' }, 403);
    }
    if (existing && existing.status !== 'Unused') {
      return json({ error: 'Passcode has already been registered' }, 409);
    }

    if (existing) {
      await db
        .prepare(
          `UPDATE passcodes
           SET status = 'Used',
               webauthn_credential_id = ?,
               public_key = ?
           WHERE passcode_id = ?`,
        )
        .bind(credentialId, publicKey, passcodeId)
        .run();
    } else {
      await db
        .prepare(
          'INSERT INTO passcodes (passcode_id, status, webauthn_credential_id, public_key) VALUES (?, ?, ?, ?)',
        )
        .bind(passcodeId, 'Used', credentialId, publicKey)
        .run();
    }

    return json({ success: true, passcode_id: passcodeId, status: 'Used' });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
