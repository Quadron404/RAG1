import { CORS, cleanString, ensurePasscodesTable, json } from './_shared.js';

/**
 * Cloudflare Pages Function - POST /api/passcodes/authenticate
 * Authenticates a used passcode by matching its registered WebAuthn credential.
 */

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
  const securityIncident = body.security_incident === true;

  if (!passcodeId) return json({ error: 'passcode_id is required' }, 400);
  if (!credentialId && !securityIncident) {
    return json({ error: 'webauthn_credential_id is required' }, 400);
  }

  try {
    await ensurePasscodesTable(db);

    const passcode = await db
      .prepare(
        `SELECT status, webauthn_credential_id, public_key
         FROM passcodes
         WHERE passcode_id = ?`,
      )
      .bind(passcodeId)
      .first();

    if (!passcode) return json({ error: 'Unknown passcode' }, 404);
    if (passcode.status === 'Flagged') {
      return json({ error: 'Passcode is flagged and permanently denied pending administrator review' }, 403);
    }
    if (passcode.status === 'Unused') {
      return json({ error: 'Passcode has not been registered with WebAuthn' }, 409);
    }

    if (securityIncident) {
      await db
        .prepare("UPDATE passcodes SET status = 'Flagged' WHERE passcode_id = ?")
        .bind(passcodeId)
        .run();

      return json({
        error: 'Security incident reported. Passcode has been flagged pending administrator review',
        status: 'Flagged',
      }, 403);
    }

    if (
      passcode.webauthn_credential_id !== credentialId
      || !passcode.public_key
    ) {
      await db
        .prepare("UPDATE passcodes SET status = 'Flagged' WHERE passcode_id = ?")
        .bind(passcodeId)
        .run();

      return json({
        error: 'Credential mismatch. Passcode has been flagged pending administrator review',
        status: 'Flagged',
      }, 403);
    }

    return json({ success: true, passcode_id: passcodeId, status: 'Used' });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
