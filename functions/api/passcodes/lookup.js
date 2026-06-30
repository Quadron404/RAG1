import { CORS, ensurePasscodesTable, json } from './_shared.js';

/**
 * Cloudflare Pages Function - POST /api/passcodes/lookup
 * Returns the current passcode state needed before WebAuthn registration/authentication.
 */

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const db = env.RAG_DB;
  if (!db) return json({ error: 'D1 binding RAG_DB not configured' }, 500);

  let passcodeId;
  try {
    const body = await request.json();
    passcodeId = typeof body.passcode_id === 'string' ? body.passcode_id.trim() : '';
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!passcodeId) return json({ error: 'passcode_id is required' }, 400);

  try {
    await ensurePasscodesTable(db);

    const passcode = await db
      .prepare(
        `SELECT passcode_id, status, webauthn_credential_id
         FROM passcodes
         WHERE passcode_id = ?`,
      )
      .bind(passcodeId)
      .first();

    if (!passcode) return json({ error: 'Unknown passcode' }, 404);
    if (passcode.status === 'Flagged') {
      return json({ error: 'Passcode is flagged and permanently denied pending administrator review' }, 403);
    }

    return json({
      passcode_id: passcode.passcode_id,
      status: passcode.status,
      webauthn_credential_id: passcode.webauthn_credential_id,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
