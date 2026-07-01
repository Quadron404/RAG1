import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import RagKeyboard from './components/RagKeyboard.jsx';
import CameraCapture from './components/CameraCapture.jsx';
import AnalyzingBar from './components/AnalyzingBar.jsx';
import StatusDashboard from './components/StatusDashboard.jsx';
import { useIsMobile } from './hooks/useIsMobile.js';
import { parseClass, parseSection } from './utils/classParser.js';

const API_URL = '/api/entries';
const PASSCODE_API = '/api/passcodes';
const SIR_API = '/api/sir';

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBuffer(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function randomChallenge() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function postPasscode(path, payload) {
  const res = await fetch(`${PASSCODE_API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const err = new Error(data.error || 'Passcode request failed');
    err.passcodeStatus = data.status;
    throw err;
  }
  return data;
}

async function fetchChallenge(passcodeId) {
  const { challenge } = await postPasscode('challenge', { passcode_id: passcodeId });
  return challenge;
}

async function registerPasscode(passcodeId) {
  const challengeB64 = await fetchChallenge(passcodeId);
  const challenge = base64UrlToBuffer(challengeB64);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'RAG Genesis' },
      user: {
        id: new TextEncoder().encode(passcodeId),
        name: passcodeId,
        displayName: 'RAG Passcode',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  });

  const publicKeyBuffer = credential.response.getPublicKey?.();
  if (!publicKeyBuffer) {
    throw new Error('This browser cannot export the WebAuthn public key');
  }

  await postPasscode('register', {
    passcode_id: passcodeId,
    webauthn_credential_id: bufferToBase64Url(credential.rawId),
    public_key: bufferToBase64Url(publicKeyBuffer),
    challenge: challengeB64,
  });
}

async function authenticatePasscode(passcodeId, credentialId) {
  try {
    const challengeB64 = await fetchChallenge(passcodeId);
    const challenge = base64UrlToBuffer(challengeB64);

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{
          id: base64UrlToBuffer(credentialId),
          type: 'public-key',
        }],
        userVerification: 'preferred',
        timeout: 60000,
      },
    });

    const response = credential.response;

    await postPasscode('authenticate', {
      passcode_id: passcodeId,
      webauthn_credential_id: bufferToBase64Url(credential.rawId),
      challenge: challengeB64,
      authenticator_data: bufferToBase64Url(response.authenticatorData),
      client_data_json: bufferToBase64Url(response.clientDataJSON),
      signature: bufferToBase64Url(response.signature),
    });
  } catch (err) {
    if (err?.name === 'NotAllowedError') {
      await postPasscode('authenticate', {
        passcode_id: passcodeId,
        security_incident: true,
      });
      const e = new Error('WebAuthn verification was cancelled');
      e.isCompromised = true;
      throw e;
    }
    throw err;
  }
}

function useClock() {
  const [t, setT] = useState('');
  useEffect(() => {
    const tick = () => {
      const s = new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata', hour12: false,
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      setT(s + ' IST');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function Stars() {
  const stars = useMemo(() =>
    Array.from({ length: 170 }, (_, i) => ({
      id: i, top: Math.random() * 100,
      size: Math.random() * 2.2 + 0.6,
      dur: Math.random() * 14 + 7,
      delay: -(Math.random() * 21),
      opacity: Math.random() * 0.5 + 0.12,
    })), []);

  return (
    <div className="stars-layer">
      {stars.map(s => (
        <div key={s.id} className="star" style={{
          top: `${s.top}%`, width: s.size, height: s.size, opacity: s.opacity,
          animation: `starDrift ${s.dur}s linear ${s.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

function SelectableContent({ text }) {
  return (
    <div className="selectable-content">
      {text.split('\n\n').map((para, i) => {
        const lines = para.split('\n');
        const isHeading = lines[0] && /^[A-Z][A-Z\s]+$/.test(lines[0].trim());
        return (
          <div key={i} style={{ marginBottom: '14px' }}>
            {lines.map((line, j) => {
              const trimmed = line.trim();
              const isBold = /^\d+\./.test(trimmed) || /^[A-Z][A-Z\s\-]+$/.test(trimmed);
              return (
                <p key={j} style={{
                  color: 'rgba(255,255,255,0.78)',
                  fontSize: isHeading ? '13px' : '12px',
                  fontWeight: isBold ? '600' : '400',
                  letterSpacing: '0.3px',
                  lineHeight: '1.7',
                  margin: '0',
                  whiteSpace: 'pre-wrap',
                }}>{trimmed}</p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function SecurityNotice({ passcodeId, onClose }) {
  return (
    <div className="auth-block">
      <Stars />
      <div className="auth-block-content">
        <img
          src="/ChatGPT_Image_Jun_15,_2026,_03_04_08_PM.png"
          alt="RAG"
          className="auth-block-logo"
        />
        <div className="auth-block-icon auth-block-icon--error">
          <svg viewBox="0 0 60 60" fill="none" aria-hidden="true">
            <circle cx="30" cy="30" r="26" stroke="#ff3333" strokeWidth="3" />
            <path d="M20 20l20 20M40 20l-20 20" stroke="#ff3333" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="auth-block-title">SECURITY NOTICE</h2>
        <div className="auth-block-text">
          <p>Your passcode (<strong>{passcodeId}</strong>) has been flagged due to a security incident or credential mismatch.</p>
          <p>This may indicate that your passcode has been compromised or accessed by an unauthorized party.</p>
          <p>Please contact your system administrator immediately to resolve this issue and obtain a new passcode.</p>
          <p>All associated credentials have been permanently revoked.</p>
        </div>
        <div className="auth-block-status auth-block-status--revoked">
          <span className="auth-block-status-dot" />
          Status: Passcode Revoked
        </div>
        <button type="button" className="auth-block-btn" onClick={() => { onClose(); }}>
          ACKNOWLEDGE
        </button>
      </div>
    </div>
  );
}

function AccessBlocked({ passcodeId, onClose }) {
  return (
    <div className="auth-block">
      <Stars />
      <div className="auth-block-content">
        <img
          src="/ChatGPT_Image_Jun_15,_2026,_03_04_08_PM.png"
          alt="RAG"
          className="auth-block-logo"
        />
        <div className="auth-block-icon auth-block-icon--block">
          <svg viewBox="0 0 60 60" fill="none" aria-hidden="true">
            <circle cx="30" cy="30" r="26" stroke="#ff3333" strokeWidth="3" />
            <path d="M18 18l24 24M42 18l-24 24" stroke="#ff3333" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="auth-block-title">ACCESS BLOCKED</h2>
        <div className="auth-block-text">
          <p>Access attempt with passcode <strong>{passcodeId}</strong> has been denied.</p>
          <p>This passcode has been permanently revoked due to a security incident.</p>
          <p>Your device is not authorized to access this system with the provided passcode.</p>
          <p>If you believe this is an error, please contact your system administrator.</p>
        </div>
        <div className="auth-block-status auth-block-status--blocked">
          <span className="auth-block-status-dot" />
          Status: Access Blocked
        </div>
        <button type="button" className="auth-block-btn" onClick={() => { onClose(); }}>
          CLOSE
        </button>
      </div>
    </div>
  );
}

function SirWarning({ onAgree, onClose }) {
  return (
    <div className="sir-overlay">
      <div className="sir-panel">
        <div className="sir-panel-header">
          <span>SECURITY INTELLIGENCE REPORT</span>
          <button type="button" className="sir-panel-close" onClick={() => { onClose(); }}>x</button>
        </div>
        <div className="sir-panel-body">
          <h3 className="sir-warning-title">Warning & Acknowledgment</h3>
          <div className="sir-warning-text">
            <p><strong>1. Authorized Use Only</strong><br />Access to RAG-Genesis is restricted to authorized personnel only. Unauthorized access, credential sharing, impersonation, or misuse of the platform is strictly prohibited. All platform activities may be logged, monitored, and audited for security, compliance, and operational purposes.</p>
            <p><strong>2. User Responsibility</strong><br />Users are solely responsible for all information submitted through the platform. All submissions must be accurate, factual, relevant, and made in good faith. Users must verify information before submission. Submission of false, misleading, fabricated, malicious, defamatory, or intentionally inaccurate information is prohibited.</p>
            <p><strong>3. Report Classification</strong><br />Information submitted through RAG-Genesis may be treated as official institutional records. Submitted reports may be reviewed by authorized administrators, investigators, disciplinary authorities, or designated officials. Reports may be retained for auditing, compliance, safeguarding, investigative, historical, or administrative purposes.</p>
            <p><strong>4. Security Monitoring</strong><br />The platform reserves the right to monitor, log, review, preserve, and audit activities performed within the system. Security controls may be employed to detect unauthorized access attempts, suspicious activity, abuse, or policy violations.</p>
            <p><strong>5. Data Processing & Storage</strong><br />Information may be stored, processed, archived, encrypted, backed up, and transmitted through authorized infrastructure providers and security partners. Data may be retained for periods determined by operational requirements, legal obligations, institutional policies, or investigative needs.</p>
            <p><strong>6. Disclosure of Information</strong><br />Information may be disclosed to authorized school officials, administrators, investigators, legal authorities, compliance officers, or safeguarding personnel when required.</p>
            <p><strong>7. Limitation of Liability</strong><br />To the maximum extent permitted by applicable law, RAG-Genesis, its developers, owners, operators, administrators, contributors, affiliates, contractors, technology providers, hosting providers, and infrastructure partners shall not be liable for: user-generated content, inaccurate reports, false statements submitted by users, administrative or disciplinary decisions made by institutions, data loss, corruption, delays, interruptions, or service outages.</p>
            <p><strong>8. Security Incident Response</strong><br />The platform reserves the right to immediately suspend, restrict, investigate, preserve evidence, or terminate access where suspicious, malicious, unauthorized, or unlawful activity is detected. Security incidents may be documented and referred to appropriate authorities when deemed necessary.</p>
          </div>
          <p className="sir-warning-consent">By clicking "I Agree", you acknowledge and accept the above terms and conditions. You confirm that you are an authorized user and that the information you submit will be accurate and truthful to the best of your knowledge.</p>
        </div>
        <div className="sir-panel-footer">
          <button type="button" className="sir-btn sir-btn--primary" onClick={() => { onAgree(); }}>
            I Agree
          </button>
        </div>
      </div>
    </div>
  );
}

function SirForm({ onSubmit, onClose }) {
  const [reporter, setReporter] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('Medium');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reporter.trim() || !category.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(SIR_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporter: reporter.trim(),
          category: category.trim(),
          severity,
          description: description.trim(),
          evidence: evidence.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Submission failed');
      onSubmit(data);
    } catch (err) {
      alert('Submission failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sir-overlay">
      <div className="sir-panel">
        <div className="sir-panel-header">
          <span>Submit Security Intelligence Report</span>
          <button type="button" className="sir-panel-close" onClick={() => { onClose(); }}>x</button>
        </div>
        <div className="sir-panel-body">
          <div className="sir-field">
            <label className="sir-label">Reporter Name *</label>
            <input type="text" className="sir-input" value={reporter} onChange={e => setReporter(e.target.value)} placeholder="Full name" disabled={submitting} />
          </div>
          <div className="sir-field">
            <label className="sir-label">Category *</label>
            <input type="text" className="sir-input" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Security, Data Breach, Policy Violation" disabled={submitting} />
          </div>
          <div className="sir-field">
            <label className="sir-label">Severity</label>
            <div className="sir-severity-row">
              {['Low', 'Medium', 'High', 'Critical'].map(s => (
                <button
                  key={s}
                  type="button"
                  className={`sir-sev-btn${severity === s ? ' sir-sev-btn--active' : ''}`}
                  onClick={() => { setSeverity(s); }}
                  disabled={submitting}
                >{s}</button>
              ))}
            </div>
          </div>
          <div className="sir-field">
            <label className="sir-label">Description *</label>
            <textarea className="sir-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detailed description of the incident..." rows={4} disabled={submitting} />
          </div>
          <div className="sir-field">
            <label className="sir-label">Evidence (optional)</label>
            <textarea className="sir-textarea" value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Supporting evidence, references, or notes..." rows={3} disabled={submitting} />
          </div>
        </div>
        <div className="sir-panel-footer">
          <button type="button" className="sir-btn sir-btn--secondary" onClick={() => { onClose(); }} disabled={submitting}>Cancel</button>
          <button type="button" className="sir-btn sir-btn--primary" onClick={handleSubmit} disabled={submitting || !reporter.trim() || !category.trim() || !description.trim()}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RagInput({ value, onChange, onEnter, inputRef, disabled, mobile, showKb, setShowKb, placeholder, className, style, password }) {
  return (
    <input
      ref={inputRef}
      type={password ? 'password' : 'text'}
      value={value}
      readOnly={mobile}
      inputMode={mobile ? 'none' : undefined}
      onChange={e => !mobile && onChange(e.target.value)}
      onFocus={() => mobile && setShowKb?.(true)}
      onKeyDown={e => { if (!mobile && e.key === 'Enter') onEnter?.(); }}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      style={style}
      autoComplete="off"
      spellCheck={false}
    />
  );
}

function PasscodeModal({ onSuccess, onCompromised }) {
  const mobile = useIsMobile();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [showKb, setShowKb] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (mobile) setShowKb(true);
    else inputRef.current?.focus();
  }, [mobile]);

  const attempt = useCallback(async () => {
    const passcodeId = input.trim();
    if (!passcodeId || busy) return;
    if (!window.PublicKeyCredential) {
      setError('WebAuthn is not supported on this browser');
      setShake(true);
      setTimeout(() => { setShake(false); setError(''); }, 1800);
      return;
    }

    setBusy(true);
    setError('');

    try {
      const passcode = await postPasscode('lookup', { passcode_id: passcodeId });

      if (passcode.status === 'Flagged' || passcode.status === 'Compromised') {
        if (passcode.webauthn_credential_id) {
          try {
            await navigator.credentials.get({
              publicKey: {
                challenge: randomChallenge(),
                allowCredentials: [{ id: base64UrlToBuffer(passcode.webauthn_credential_id), type: 'public-key' }],
                userVerification: 'preferred',
                timeout: 30000,
              },
            });
            onCompromised(passcodeId, 'original');
          } catch {
            onCompromised(passcodeId, 'unauthorized');
          }
        } else {
          onCompromised(passcodeId, 'unauthorized');
        }
        setBusy(false);
        return;
      }

      if (passcode.status === 'Unused') {
        await registerPasscode(passcodeId);
      } else if (passcode.status === 'Used' && passcode.webauthn_credential_id) {
        await authenticatePasscode(passcodeId, passcode.webauthn_credential_id);
      } else {
        throw new Error('Passcode is not available for authentication');
      }

      onSuccess();
    } catch (err) {
      if (err.passcodeStatus === 'Compromised' || err.passcodeStatus === 'Flagged' || err.isCompromised) {
        onCompromised(passcodeId, 'unauthorized');
        return;
      }
      setError(err.message || 'Authentication failed');
      setShake(true);
      setInput('');
      setTimeout(() => { setShake(false); setError(''); }, 2200);
    } finally {
      setBusy(false);
    }
  }, [busy, input, onSuccess, onCompromised]);

  const kbAppend = ch => setInput(v => v + ch);
  const kbBack = () => setInput(v => v.slice(0, -1));

  return (
    <div className="pass-overlay">
      <div className={`pass-card${shake ? ' pass-card--shake' : ''}`} onClick={() => mobile && setShowKb(true)}>
        <div className="pass-brand">RAG</div>
        <p className="pass-label">Enter passcode to continue</p>

        <div className="pass-field-wrap">
          <RagInput
            inputRef={inputRef}
            value={input}
            onChange={setInput}
            onEnter={attempt}
            disabled={busy}
            mobile={mobile}
            showKb={showKb}
            setShowKb={setShowKb}
            password
            placeholder="Type passcode"
            className="pass-input"
          />
        </div>

        {error && <p className="pass-error">{error}</p>}

        <button type="button" className="pass-btn" onClick={attempt} disabled={busy}>
          {busy ? 'Verifying' : 'Unlock'}
        </button>
      </div>

      {mobile && (
        <div style={{ display: showKb ? '' : 'none' }}>
          <RagKeyboard
            onKey={kbAppend}
            onBackspace={kbBack}
            onEnter={attempt}
            onClose={() => setShowKb(false)}
          />
        </div>
      )}
    </div>
  );
}

function CliModal({ onClose }) {
  const mobile = useIsMobile();
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showKb, setShowKb] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [step, setStep] = useState('class');
  const [classNum, setClassNum] = useState(null);
  const [section, setSection] = useState(null);
  const [sirWarning, setSirWarning] = useState(false);
  const [sirForm, setSirForm] = useState(false);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  useEffect(() => {
    setHistory([{ type: 'sys', text: 'Enter class (1-12), e.g. 5 or 5th. Type SIR to file a Security Intelligence Report.' }]);
  }, []);

  useEffect(() => {
    if (mobile) setShowKb(true);
    else inputRef.current?.focus();
  }, [mobile]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history, analyzing]);

  function fmtBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(2) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  }

  const storeEntry = useCallback(async (text) => {
    const idx = history.length;
    setHistory(h => [...h, { type: 'cmd', text, status: 'uploading', uploadResult: null }]);
    setUploadStatus({ lines: [{ type: 'info', text: 'Preparing request...' }] });

    const startTime = performance.now();
    const payload = JSON.stringify({ content: text, class: classNum, section });
    const bodyBlob = new Blob([payload], { type: 'application/json' });
    const bodySize = bodyBlob.size;
    const isLarge = bodySize > 1024;

    const addLine = (line) => setUploadStatus(s => ({ lines: [...s.lines, line] }));
    const replaceLast = (line) => setUploadStatus(s => {
      const l = [...s.lines];
      l[l.length - 1] = line;
      return { lines: l };
    });

    function progressLine(pct, loaded, total, speed, elapsed) {
      return { type: 'progress', pct, loaded, total, speed: speed.toFixed(1), elapsed: elapsed.toFixed(2) };
    }

    addLine({ type: 'info', text: 'Connecting → Cloudflare Edge...' });
    addLine({ type: 'info', text: 'TLS established' });

    if (isLarge) addLine({ type: 'info', text: 'Uploading...' });
    else addLine({ type: 'info', text: 'Sending request...' });

    let responseTime = 0, cfRay = null, dbSuccess = false, errMsg = '';

    try {
      if (isLarge) {
        const xhrResult = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', API_URL);
          xhr.setRequestHeader('Content-Type', 'application/json');
          let progressAdded = false;
          const uploadStart = performance.now();
          xhr.upload.addEventListener('progress', (e) => {
            if (!e.lengthComputable) return;
            const elapsed = (performance.now() - uploadStart) / 1000;
            const speed = elapsed > 0 ? (e.loaded / 1024) / elapsed : 0;
            const line = progressLine(Math.round(e.loaded / e.total * 100), e.loaded, e.total, speed, elapsed);
            if (!progressAdded) { addLine(line); progressAdded = true; }
            else replaceLast(line);
          });
          xhr.addEventListener('loadend', () => {
            responseTime = performance.now() - startTime;
            cfRay = xhr.getResponseHeader('cf-ray');
            try { resolve({ data: JSON.parse(xhr.responseText), status: xhr.status }); }
            catch { reject(new Error('Invalid server response')); }
          });
          xhr.addEventListener('error', () => reject(new Error('Network error')));
          xhr.send(bodyBlob);
        });
        responseTime = performance.now() - startTime;
        cfRay = cfRay || (xhrResult.status >= 200 && xhrResult.status < 300 ? null : null);
        dbSuccess = xhrResult.status >= 200 && xhrResult.status < 300 && !xhrResult.data?.error;
        errMsg = xhrResult.data?.error || '';
        addLine({ type: 'info', text: 'Waiting for server...' });
      } else {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
        responseTime = performance.now() - startTime;
        cfRay = res.headers.get('cf-ray');
        const data = await res.json();
        dbSuccess = res.ok && !data.error;
        errMsg = data.error || '';
        addLine({ type: 'info', text: 'Waiting for server...' });
      }
    } catch (err) {
      addLine({ type: 'error', text: err.message || 'Network error' });
      setHistory(h => { const n = [...h]; if (n.length > idx) { n[idx] = { ...n[idx], status: 'err' }; } return n; });
      setUploadStatus(null);
      return;
    }

    if (dbSuccess) addLine({ type: 'kv', key: 'Cloudflare Worker', value: 'Accepted' });
    else addLine({ type: 'kv', key: 'Cloudflare Worker', value: 'Error' });
    addLine({ type: 'kv', key: 'Database Write', value: dbSuccess ? 'Success' : 'Failed' });
    addLine({ type: 'kv', key: 'Response Time', value: `${Math.round(responseTime)} ms` });
    if (cfRay) addLine({ type: 'kv', key: 'CF-Ray', value: cfRay });

    if (dbSuccess) {
      addLine({ type: 'success', text: 'Stored successfully' });
      setHistory(h => { const n = [...h]; if (n.length > idx) { n[idx] = { ...n[idx], status: 'ok' }; } return n; });
    } else {
      addLine({ type: 'error', text: errMsg || 'Storage failed' });
      setHistory(h => { const n = [...h]; if (n.length > idx) { n[idx] = { ...n[idx], status: 'err' }; } return n; });
    }
    setUploadStatus(null);
  }, [history.length, classNum, section]);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || busy || analyzing) return;

    if (text.toUpperCase() === 'SIR') {
      setSirWarning(true);
      setInput('');
      return;
    }

    setBusy(true);
    setInput('');

    if (step === 'class') {
      setHistory(h => [...h, { type: 'cmd', text }]);
      const cls = parseClass(text);
      if (!cls) {
        setHistory(h => [...h, { type: 'sys', text: 'Invalid class. Enter 1-12 (e.g. 1, 5th, 12th).' }]);
      } else {
        setClassNum(cls);
        setStep('section');
        setHistory(h => [...h, { type: 'sys', text: `Class ${cls} set. Enter section (A-Z).` }]);
      }
    } else if (step === 'section') {
      setHistory(h => [...h, { type: 'cmd', text }]);
      const sec = parseSection(text);
      if (!sec) {
        setHistory(h => [...h, { type: 'sys', text: 'Invalid section. Enter a single letter A-Z.' }]);
      } else {
        setSection(sec);
        setStep('data');
        setHistory(h => [...h, {
          type: 'sys',
          text: `Ready - Class ${classNum}, Section ${sec}. Enter data to store.`,
        }]);
      }
    } else {
      await storeEntry(text);
    }

    setBusy(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [input, busy, analyzing, step, classNum, storeEntry]);

  const handleImageCapture = useCallback(async (result) => {
    setCameraOpen(false);

    if (!result || result.error) {
      const errCode = result?.exitCode ? ` (exitCode: ${result.exitCode})` : '';
      const fileCode = result?.fileExitCode ? ` fileExitCode: ${result.fileExitCode}` : '';
      const errDetail = result?.errDetails ? ` ${result.errDetails}` : '';
      setHistory(h => [...h, { type: 'sys', text: `[!!] OCR failed${errCode}${fileCode}${errDetail}: ${result?.error || 'unknown error'}` }]);
      setAnalyzing(false);
      setTimeout(() => inputRef.current?.focus(), 60);
      return;
    }

    const extracted = result.text || '';
    setAnalyzing(true);
    setHistory(h => [...h, { type: 'sys', text: '[Image Ingest] OCR complete.' }]);

    if (extracted) {
      setHistory(h => [...h, { type: 'ocr', text: extracted }]);
    } else {
      setHistory(h => [...h, {
        type: 'sys',
        text: `[!!] OCR returned no text (exitCode: ${result.exitCode} parsedCount: ${result.parsedCount} fileExitCode: ${result.fileParseExitCode})`
      }]);
      setAnalyzing(false);
      setTimeout(() => inputRef.current?.focus(), 60);
      return;
    }

    if (step === 'data') {
      setInput(extracted);
      setHistory(h => [...h, {
        type: 'sys',
        text: 'Text extracted. Review and press Enter to store.',
      }]);
    } else {
      setInput(extracted);
      setHistory(h => [...h, {
        type: 'sys',
        text: 'Text extracted. Complete class & section setup first.',
      }]);
    }

    setAnalyzing(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [step]);

  const promptLabel = step === 'class'
    ? 'class'
    : step === 'section'
      ? 'section'
      : `C${classNum}-${section}`;

  const kbAppend = ch => setInput(v => v + ch);
  const kbBack = () => setInput(v => v.slice(0, -1));

  return (
    <>
      <div className="cli-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="cli-window">
          <div className="cli-titlebar">
            <span>C:\RAG-Genesis\cmd.exe</span>
            <button type="button" className="cli-close" onClick={onClose}>x</button>
          </div>

          <div className="cli-body" onClick={() => inputRef.current?.focus()}>
            <div className="cli-banner">RAG-Genesis [Version 2.7182.8]</div>

            {history.map((entry, i) => (
              <div key={i} className="cli-line">
                {entry.type === 'cmd' && (
                  <div>
                    <span className="cli-prompt">C:\RAG-Genesis&gt;&nbsp;</span>
                    <span>{entry.text}</span>
                  </div>
                )}
                {entry.type === 'sys' && <div className="cli-sys">{entry.text}</div>}
                {entry.type === 'ocr' && (
                  <div className="cli-ocr">
                    <span className="cli-prompt">[OCR]&nbsp;</span>{entry.text}
                  </div>
                )}
                {entry.status === 'uploading' && uploadStatus && (
                  <div className="cli-upload-status">
                    {uploadStatus.lines.map((line, li) => (
                      <div key={li} className={`cli-ul-${line.type}`}>
                        {line.type === 'progress' && (
                          <span>  {line.pct}%  ↑ {fmtBytes(line.loaded)} / {fmtBytes(line.total)}  Speed: {line.speed} KB/s  Elapsed: {line.elapsed}s</span>
                        )}
                        {line.type === 'info' && <span>  {line.text}</span>}
                        {line.type === 'kv' && (
                          <span>  {line.key.padEnd(18)}: {line.value}</span>
                        )}
                        {line.type === 'success' && <span>  ✓ {line.text}</span>}
                        {line.type === 'error' && <span>  ✗ {line.text}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {entry.status === 'ok' && (
                  <div className="cli-ok">  ✓ Stored in Class {classNum}, Section {section}.</div>
                )}
                {entry.status === 'err' && (
                  <div className="cli-err">  ✗ Storage failed.</div>
                )}
              </div>
            ))}

            {analyzing && <AnalyzingBar />}

            <div className="cli-input-row">
              <span className="cli-prompt">C:\RAG-Genesis&gt;&nbsp;</span>
              <RagInput
                inputRef={inputRef}
                value={input}
                onChange={setInput}
                onEnter={submit}
                disabled={busy || analyzing}
                mobile={mobile}
                showKb={showKb}
                setShowKb={setShowKb}
                className="cli-input"
              />
              <span className="cli-step-tag">{promptLabel}</span>
            </div>
            <div ref={bottomRef} />
          </div>

          <div className="cli-actionbar">
            <span className="cli-status">
              {analyzing ? 'ANALYZING' : busy ? 'UPLOADING...' : 'READY'}
            </span>
            <div className="cli-actions">
              <button
                type="button"
                className="cli-action-btn"
                onClick={() => { setCameraOpen(true); }}
                disabled={busy || analyzing}
              >
                Image Ingest
              </button>
              <button
                type="button"
                className="cli-action-btn cli-action-btn--primary"
                onClick={submit}
                disabled={busy || analyzing}
              >
                ENTER
              </button>
            </div>
          </div>
        </div>
      </div>

      {mobile && !cameraOpen && !sirWarning && !sirForm && (
        <div style={{ display: showKb ? '' : 'none' }}>
          <RagKeyboard
            onKey={kbAppend}
            onBackspace={kbBack}
            onEnter={submit}
            onClose={() => setShowKb(false)}
          />
        </div>
      )}

      {cameraOpen && (
        <CameraCapture
          onCapture={handleImageCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {sirWarning && (
        <SirWarning
          onAgree={() => { setSirWarning(false); setSirForm(true); }}
          onClose={() => setSirWarning(false)}
        />
      )}

      {sirForm && (
        <SirForm
          onSubmit={(data) => {
            setSirForm(false);
            setHistory(h => [...h, { type: 'sys', text: `[SIR] Report submitted successfully. Reference: ${data.id}` }]);
          }}
          onClose={() => setSirForm(false)}
        />
      )}
    </>
  );
}

function MainPage({ locked }) {
  const [cliOpen, setCliOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const clock = useClock();

  const termsContent = `TERMS AND CONDITIONS

Effective Date: 24 June 2026

These Terms and Conditions ("Terms") govern access to and use of RAG, a secure digital platform designed to facilitate the recording, management, and submission of student disciplinary information and related records to authorized educational institutions.

By accessing or using RAG, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree, you must discontinue use of the Platform immediately.

1. Purpose of the Platform
RAG is intended solely for the collection, processing, and submission of student disciplinary records and associated documentation by duly authorized users, including but not limited to prefects, designated staff members, and school authorities.
The Platform may include Optical Character Recognition ("OCR") and other automated technologies to convert uploaded images or handwritten reports into editable text. Such technologies are provided solely as an aid and do not guarantee complete accuracy.

2. Authorized Use
Access to RAG is restricted to authorized individuals appointed or approved by the relevant educational institution.
Users shall: Use the Platform only for legitimate institutional purposes; Act honestly, responsibly, and in good faith; Ensure that all information entered is accurate, complete, and truthful; Exercise reasonable care while uploading reports and documents; Verify OCR-generated text before submission; Maintain the confidentiality of login credentials and account information.
Unauthorized use, impersonation, tampering, misuse, or attempts to compromise the Platform are strictly prohibited.

3. Accuracy of Information
Users, including prefects and authorized personnel, bear sole responsibility for the accuracy, completeness, and correctness of all information submitted through RAG.
The Platform serves only as a medium for recording and transmitting information and does not independently verify the authenticity or correctness of submitted data.
Users must carefully review all entries before final submission.
Knowingly submitting false, misleading, inaccurate, incomplete, manipulated, defamatory, or unauthorized information may result in administrative action by the relevant institution and may expose the responsible individual to disciplinary or legal consequences under applicable laws.

4. OCR and Automated Processing Disclaimer
RAG may utilize cloud-based OCR and automated technologies to extract text from images and written reports.
Users acknowledge and agree that: OCR results may contain inaccuracies, omissions, formatting errors, or misinterpretations; Handwriting quality, image quality, lighting conditions, and document conditions may affect accuracy; OCR-generated text must be independently reviewed and corrected by the user before submission; RAG, its owners, developers, operators, contributors, and licensors do not guarantee the accuracy or completeness of OCR outputs.
Failure to verify OCR-generated content remains the sole responsibility of the user.

5. No Warranty
THE PLATFORM IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS.
TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, RAG AND ITS OWNERS, DEVELOPERS, CONTRIBUTORS, OPERATORS, ADMINISTRATORS, AND AFFILIATES DISCLAIM ALL WARRANTIES, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF: Accuracy; Reliability; Availability; Security; Fitness for a particular purpose; Non-infringement; Continuous or uninterrupted operation; Error-free performance.
No representation is made that the Platform will always be free from defects, bugs, interruptions, delays, or inaccuracies.

6. Limitation of Liability
TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OWNERS, CREATORS, DEVELOPERS, CONTRIBUTORS, ADMINISTRATORS, OPERATORS, AFFILIATES, AND LICENSORS OF RAG SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES ARISING FROM OR RELATED TO: Errors or inaccuracies in manually entered information; Incorrect OCR conversions or automated outputs; User negligence or misuse; Data omissions or typographical errors; Delays, interruptions, or technical failures; Loss of records or information; Reliance placed upon information stored or transmitted through the Platform; Unauthorized access caused by user negligence; Decisions made by schools or institutions based on submitted information.
Users assume all risks associated with the use of the Platform.

7. User Responsibility and Indemnification
Users agree to defend, indemnify, and hold harmless RAG and its owners, developers, contributors, administrators, employees, operators, and affiliates from and against any claims, losses, damages, liabilities, costs, expenses, or legal fees arising from: False or inaccurate information submitted by the user; Improper use of the Platform; Violation of these Terms; Unauthorized disclosure of credentials; Breach of applicable laws or institutional policies.

8. Data Security
RAG employs reasonable technical and administrative safeguards intended to protect information from unauthorized access.
However, no electronic system, software, network, or transmission method can guarantee absolute security. Users acknowledge that the transmission and storage of information involve inherent risks.
Accordingly, no guarantee is made regarding uninterrupted availability or absolute protection against cyber threats, hardware failures, or unforeseen technical incidents.

9. Suspension and Termination
RAG reserves the right to suspend, restrict, disable, or terminate access to any account that: Provides false or misleading information; Engages in unauthorized activities; Attempts to interfere with the Platform's operation or security; Violates these Terms or institutional policies.
Such action may be taken without prior notice.

10. Reporting Errors
Users are encouraged to promptly report suspected technical issues, software errors, or inaccuracies to the Platform administrator or owner.
Submission of an error report does not constitute an admission of liability nor create any obligation to compensate users for losses or damages.

11. Modifications
RAG reserves the right to amend, update, modify, suspend, or discontinue any aspect of the Platform or these Terms at any time without prior notice.
Continued use of the Platform following modifications constitutes acceptance of the revised Terms.

12. Severability
If any provision of these Terms is determined to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.

13. Governing Law
These Terms shall be governed by and interpreted in accordance with the applicable laws of the jurisdiction in which the owner or operating entity of RAG is established.

14. Acceptance
By accessing or using RAG, users acknowledge that they have read, understood, and voluntarily accepted these Terms and Conditions and agree to assume responsibility for the accuracy of information submitted through the Platform.
Failure to comply with these Terms may result in suspension of access and further administrative or legal action where applicable.`;

  const docsContent = `RAG-GENESIS DOCUMENTATION

SECURITY, PRIVACY, LIABILITY & AUTHORIZED USE POLICY

1. Authorized Use Only
Access to RAG-Genesis is restricted to authorized personnel only.
Unauthorized access, credential sharing, impersonation, or misuse of the platform is strictly prohibited.
All platform activities may be logged, monitored, and audited for security, compliance, and operational purposes.

2. User Responsibility
Users are solely responsible for all information submitted through the platform.
All submissions must be accurate, factual, relevant, and made in good faith.
Users must verify information before submission.
Submission of false, misleading, fabricated, malicious, defamatory, or intentionally inaccurate information is prohibited.

3. Report Classification
Information submitted through RAG-Genesis may be treated as official institutional records.
Submitted reports may be reviewed by authorized administrators, investigators, disciplinary authorities, or designated officials.
Reports may be retained for auditing, compliance, safeguarding, investigative, historical, or administrative purposes.

4. Security Monitoring
The platform reserves the right to monitor, log, review, preserve, and audit activities performed within the system.
Security controls may be employed to detect unauthorized access attempts, suspicious activity, abuse, or policy violations.
Security logs may be retained for operational, investigative, and compliance purposes.

5. Data Processing & Storage
Information may be stored, processed, archived, encrypted, backed up, and transmitted through authorized infrastructure providers and security partners.
Data may be retained for periods determined by operational requirements, legal obligations, institutional policies, or investigative needs.
Complete deletion of records may not be immediately possible due to backup, archival, auditing, or legal retention requirements.

6. Disclosure of Information
Information may be disclosed to authorized school officials, administrators, investigators, legal authorities, compliance officers, or safeguarding personnel when required.
Information may be disclosed where necessary to: Protect individuals or institutional safety; Investigate misconduct or policy violations; Comply with legal obligations; Respond to lawful requests from competent authorities; Protect the integrity and security of the platform.

7. No Verification Guarantee
RAG-Genesis acts solely as an information collection, management, and reporting platform.
The platform does not independently verify the accuracy, authenticity, reliability, completeness, or legality of user-submitted content.
Responsibility for submitted information remains exclusively with the submitting user.

8. Limitation of Liability
To the maximum extent permitted by applicable law, RAG-Genesis, its developers, owners, operators, administrators, contributors, affiliates, contractors, technology providers, hosting providers, and infrastructure partners shall not be liable for: User-generated content; Inaccurate reports; False statements submitted by users; Administrative or disciplinary decisions made by institutions; Data loss, corruption, delays, interruptions, or service outages; Third-party infrastructure failures; Unauthorized actions performed by users; Consequential, indirect, incidental, punitive, reputational, academic, financial, or operational damages.

9. Security Incident Response
The platform reserves the right to immediately suspend, restrict, investigate, preserve evidence, or terminate access where suspicious, malicious, unauthorized, or unlawful activity is detected.
Security incidents may be documented and referred to appropriate authorities when deemed necessary.

10. Prohibited Activities
The following activities are strictly prohibited: Unauthorized access attempts; Credential sharing; Identity impersonation; Data manipulation or falsification; Submission of fabricated reports; Security testing without written authorization; Attempting to bypass security controls; Automated scraping, extraction, or harvesting of platform data; Interference with platform availability, integrity, or operations.

11. Platform Rights
RAG-Genesis reserves the right to modify, suspend, restrict, archive, preserve, remove, investigate, or terminate any account, report, record, feature, or service without prior notice where necessary for security, compliance, operational, legal, or administrative reasons.

12. Acceptance of Terms
Accessing or using RAG-Genesis constitutes acknowledgement and acceptance of this policy.
Users acknowledge that all actions performed within the platform may be attributable to their authenticated account.
Continued use of the platform signifies ongoing acceptance of all current and future policy revisions.

OFFICIAL NOTICE
RAG-Genesis is a controlled administrative reporting system. Unauthorized access, misuse, data manipulation, submission of false information, interference with system operations, or attempts to circumvent security controls may result in immediate account termination, institutional disciplinary action, investigation, and referral to appropriate authorities where permitted by law.`;

  return (
    <div className="main-page">
      <div className="main-content">
        <img
          src="/ChatGPT_Image_Jun_15,_2026,_03_04_08_PM.png"
          alt="RAG - Neural Net-Based Artificial Intelligence"
          className="main-logo"
          fetchPriority="high"
          decoding="async"
        />

        <button
          type="button"
          className="enter-data-btn"
          onClick={() => {

            if (!locked) setCliOpen(true);
          }}
          disabled={locked}
          style={locked ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
        >
          ENTER DATA
        </button>
      </div>

      <Stars />

      <div className="main-footer">
        <button type="button" className="main-footer-link" onClick={() => setDocsOpen(true)}>Documentation</button>
        <span className="main-footer-brand">
          By using RAG Software you agree with its{' '}
          <button type="button" className="main-footer-inline" onClick={() => setTermsOpen(true)}>
            Terms & Conditions
          </button>
        </span>
        <span className="main-footer-clock main-footer-clock--bold">{clock}</span>
      </div>

      {termsOpen && (
        <div className="policy-panel" onClick={e => { if (e.target === e.currentTarget) setTermsOpen(false); }}>
          <div className="policy-card policy-card--large">
            <div className="policy-titlebar">
              <span>Terms & Conditions</span>
              <button type="button" onClick={() => setTermsOpen(false)}>x</button>
            </div>
            <div className="policy-scroll">
              <SelectableContent text={termsContent} />
            </div>
          </div>
        </div>
      )}

      {docsOpen && (
        <div className="policy-panel" onClick={e => { if (e.target === e.currentTarget) setDocsOpen(false); }}>
          <div className="policy-card policy-card--large">
            <div className="policy-titlebar">
              <span>Documentation</span>
              <button type="button" onClick={() => setDocsOpen(false)}>x</button>
            </div>
            <div className="policy-scroll">
              <SelectableContent text={docsContent} />
            </div>
          </div>
        </div>
      )}

      {cliOpen && <CliModal onClose={() => setCliOpen(false)} />}
    </div>
  );
}

function PrivacyPopup({ onAgree }) {
  return (
    <div className="policy-panel policy-panel--top">
      <div className="policy-card policy-card--privacy">
        <div className="policy-titlebar">
          <span>Privacy Policy</span>
        </div>
        <div className="policy-scroll">
          <div className="selectable-content">
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '12px', lineHeight: '1.7', marginBottom: '14px' }}>By using RAG-Genesis, you acknowledge and accept the following:</p>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '12px', lineHeight: '1.7', marginBottom: '14px' }}><strong>Data Collection:</strong> The platform collects and processes information you submit, including disciplinary records and associated documentation.</p>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '12px', lineHeight: '1.7', marginBottom: '14px' }}><strong>Data Usage:</strong> Submitted information is used for institutional record-keeping, reporting, and administrative purposes as authorized by your institution.</p>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '12px', lineHeight: '1.7', marginBottom: '14px' }}><strong>Data Retention:</strong> Information may be retained for periods determined by operational requirements, legal obligations, and institutional policies.</p>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '12px', lineHeight: '1.7', marginBottom: '14px' }}><strong>Data Sharing:</strong> Information may be disclosed to authorized school officials, administrators, investigators, and legal authorities as required.</p>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '12px', lineHeight: '1.7', marginBottom: '14px' }}><strong>Security:</strong> Reasonable security measures are employed to protect your data. However, no electronic system can guarantee absolute security.</p>
          </div>
        </div>
        <button type="button" className="policy-agree" onClick={onAgree}>
          I Agree
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [compromisedData, setCompromisedData] = useState(null);
  const [showStatus, setShowStatus] = useState(false);
  const statusShownRef = useRef(false);

  useEffect(() => {
    if (authed && !privacyOpen && !compromisedData && !statusShownRef.current) {
      statusShownRef.current = true;
      setShowStatus(true);
    }
  }, [authed, privacyOpen, compromisedData]);

  return (
    <>
      <MainPage locked={!authed} />
      {!authed && !compromisedData && <PasscodeModal onSuccess={() => { setAuthed(true); setPrivacyOpen(true); }} onCompromised={(id, type) => setCompromisedData({ passcodeId: id, type })} />}
      {compromisedData && compromisedData.type === 'original' && <SecurityNotice passcodeId={compromisedData.passcodeId} onClose={() => setCompromisedData(null)} />}
      {compromisedData && compromisedData.type === 'unauthorized' && <AccessBlocked passcodeId={compromisedData.passcodeId} onClose={() => setCompromisedData(null)} />}
      {authed && privacyOpen && <PrivacyPopup onAgree={() => setPrivacyOpen(false)} />}
      <div className="status-trigger" onClick={() => setShowStatus(true)}>
        <span className="status-trigger-dot" style={{ background: '#00ff88', boxShadow: '0 0 8px #00ff88' }} />
        <span className="status-trigger-label">Status</span>
      </div>
      {showStatus && <StatusDashboard onClose={() => setShowStatus(false)} />}
    </>
  );
}
