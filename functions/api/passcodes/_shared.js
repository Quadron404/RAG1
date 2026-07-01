export const DEFAULT_PASSCODE = '';

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

export function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlToBuffer(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function readDERInteger(bytes, offset) {
  if (bytes[offset++] !== 0x02) throw new Error('Expected INTEGER');
  let length = bytes[offset++];
  if (length & 0x80) {
    const numLen = length & 0x7F;
    length = 0;
    for (let i = 0; i < numLen; i++) length = (length << 8) + bytes[offset++];
  }
  const value = bytes.slice(offset, offset + length);
  return { value, consumed: 2 + (length > 127 ? length > 255 ? 3 : 2 : 1) + length };
}

function derToP1363(derBytes) {
  if (derBytes[0] !== 0x30) return null;
  let off = 1;
  if (derBytes[1] & 0x80) off += (derBytes[1] & 0x7F) + 1; else off++;
  try {
    const r = readDERInteger(derBytes, off);
    off += r.consumed;
    const s = readDERInteger(derBytes, off);
    const coordLen = Math.max(r.value.length, s.value.length);
    const out = new Uint8Array(coordLen * 2);
    if (r.value.length < coordLen) out.set(r.value, coordLen - r.value.length); else out.set(r.value.slice(r.value.length - coordLen), 0);
    if (s.value.length < coordLen) out.set(s.value, coordLen + coordLen - s.value.length); else out.set(s.value.slice(s.value.length - coordLen), coordLen);
    return out;
  } catch {
    return null;
  }
}

export async function verifyWebAuthnSignature(storedPublicKeyB64, authenticatorDataB64, clientDataJSONB64, signatureB64) {
  let spkiBytes;
  try { spkiBytes = new Uint8Array(base64UrlToBuffer(storedPublicKeyB64)); } catch { return false; }
  let authenticatorData, clientDataJSON, signature;
  try {
    authenticatorData = new Uint8Array(base64UrlToBuffer(authenticatorDataB64));
    clientDataJSON = new Uint8Array(base64UrlToBuffer(clientDataJSONB64));
    signature = new Uint8Array(base64UrlToBuffer(signatureB64));
  } catch { return false; }

  if (!authenticatorData.length || !clientDataJSON.length || !signature.length) return false;

  let clientDataHash;
  try { clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON)); } catch { return false; }

  const signedData = new Uint8Array(authenticatorData.length + clientDataHash.length);
  signedData.set(authenticatorData, 0);
  signedData.set(clientDataHash, authenticatorData.length);

  let key;
  try {
    key = await crypto.subtle.importKey('spki', spkiBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    try {
      if (await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, signedData)) return true;
    } catch {}
    const p1363 = derToP1363(signature);
    if (p1363) try {
      if (await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, p1363, signedData)) return true;
    } catch {}
  } catch {}

  try {
    key = await crypto.subtle.importKey('spki', spkiBytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signedData);
  } catch {
    return false;
  }
}

export function generateChallenge() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bufferToBase64Url(bytes);
}

export async function ensureTables(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS passcodes (
        passcode_id             TEXT PRIMARY KEY,
        status                  TEXT NOT NULL DEFAULT 'Unused'
                                CHECK (status IN ('Unused', 'Used', 'Flagged', 'Compromised')),
        webauthn_credential_id  TEXT UNIQUE,
        public_key              TEXT,
        signature_counter       INTEGER DEFAULT 0,
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

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS webauthn_challenges (
        passcode_id TEXT PRIMARY KEY,
        challenge   TEXT NOT NULL,
        created_at  INTEGER NOT NULL
      )`,
    )
    .run();
}

export async function storeChallenge(db, passcodeId, challenge) {
  await db
    .prepare('INSERT OR REPLACE INTO webauthn_challenges (passcode_id, challenge, created_at) VALUES (?, ?, ?)')
    .bind(passcodeId, challenge, Date.now())
    .run();
}

export async function verifyChallenge(db, passcodeId, challenge) {
  const row = await db
    .prepare('SELECT challenge, created_at FROM webauthn_challenges WHERE passcode_id = ?')
    .bind(passcodeId)
    .first();
  if (!row) return false;
  if (row.challenge !== challenge) return false;
  if (Date.now() - row.created_at > 300000) return false;
  await db.prepare('DELETE FROM webauthn_challenges WHERE passcode_id = ?').bind(passcodeId).run();
  return true;
}

export async function ensurePasscodesTable(db) {
  const k = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='passcodes'").first();
  if (!k) {
    await ensureTables(db);
    return;
  }
  await db.prepare(`CREATE TABLE IF NOT EXISTS webauthn_challenges (
    passcode_id TEXT PRIMARY KEY,
    challenge   TEXT NOT NULL,
    created_at  INTEGER NOT NULL
  )`).run();
  try { await db.prepare("ALTER TABLE passcodes ADD COLUMN signature_counter INTEGER DEFAULT 0").run(); } catch {}
}
