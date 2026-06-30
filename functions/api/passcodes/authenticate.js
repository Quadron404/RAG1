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
  const securityIncident = body.security_incident === true;

  if (!passcodeId) return json({ error: 'passcode_id is required' }, 400);
  if (!credentialId && !securityIncident) {
    return json({ error: 'webauthn_credential_id is required' }, 400);
  }

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

    const passcode = await db
      .prepare(
        `SELECT status, webauthn_credential_id, public_key
         FROM passcodes
         WHERE passcode_id = ?`,
      )
      .bind(passcodeId)
      .first();

    if (!passcode) return json({ error: 'Passcode not registered' }, 404);

    if (passcode.status === 'Flagged' || passcode.status === 'Compromised') {
      return json({
        error: 'Passcode is permanently denied',
        status: passcode.status,
      }, 403);
    }

    if (securityIncident) {
      await db
        .prepare("UPDATE passcodes SET status = 'Compromised' WHERE passcode_id = ?")
        .bind(passcodeId)
        .run();

      return json({
        error: 'Security incident reported. Passcode has been revoked.',
        status: 'Compromised',
      }, 403);
    }

    if (
      passcode.webauthn_credential_id !== credentialId
      || !passcode.public_key
    ) {
      await db
        .prepare("UPDATE passcodes SET status = 'Compromised' WHERE passcode_id = ?")
        .bind(passcodeId)
        .run();

      return json({
        error: 'Credential mismatch. Passcode has been revoked.',
        status: 'Compromised',
        webauthn_credential_id: passcode.webauthn_credential_id,
      }, 403);
    }

    return json({ success: true, passcode_id: passcodeId, status: 'Used' });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
