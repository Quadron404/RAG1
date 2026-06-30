import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import RagKeyboard from './components/RagKeyboard.jsx';
import CameraCapture from './components/CameraCapture.jsx';
import AnalyzingBar from './components/AnalyzingBar.jsx';
import { useIsMobile } from './hooks/useIsMobile.js';
import { parseClass, parseSection } from './utils/classParser.js';

const API_URL = '/api/entries';
const PASSCODE_API = '/api/passcodes';

function haptic(strength = 8) {
  navigator.vibrate?.(strength);
}

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
  if (!res.ok || data.error) throw new Error(data.error || 'Passcode request failed');
  return data;
}

async function registerPasscode(passcodeId) {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
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
  });
}

async function authenticatePasscode(passcodeId, credentialId) {
  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        allowCredentials: [{
          id: base64UrlToBuffer(credentialId),
          type: 'public-key',
        }],
        userVerification: 'preferred',
        timeout: 60000,
      },
    });

    await postPasscode('authenticate', {
      passcode_id: passcodeId,
      webauthn_credential_id: bufferToBase64Url(credential.rawId),
    });
  } catch (err) {
    if (err?.name === 'NotAllowedError') {
      await postPasscode('authenticate', {
        passcode_id: passcodeId,
        security_incident: true,
      });
      throw new Error('WebAuthn verification was cancelled or unavailable on this device');
    }
    throw err;
  }
}

/* â”€â”€ IST Clock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€ Stars â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€ ASCII Upload Animation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const BAR_FRAMES = [
  '[          ] 0%  uploading',
  '[==        ] 20% uploading',
  '[====      ] 40% uploading',
  '[======    ] 60% uploading',
  '[========  ] 80% uploading',
  '[==========] 99% uploading',
];

function AsciiProgress() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % BAR_FRAMES.length), 280);
    return () => clearInterval(id);
  }, []);
  return <span className="ascii-progress">{BAR_FRAMES[frame]}</span>;
}

/* â”€â”€ Mobile-aware input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€ Passcode Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function PasscodeModal({ onSuccess }) {
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
      if (passcode.status === 'Unused') {
        await registerPasscode(passcodeId);
      } else if (passcode.status === 'Used' && passcode.webauthn_credential_id) {
        await authenticatePasscode(passcodeId, passcode.webauthn_credential_id);
      } else {
        throw new Error('Passcode is not available for authentication');
      }

      haptic([8, 24, 8]);
      onSuccess();
    } catch (err) {
      haptic([20, 40, 20]);
      setError(err.message || 'Incorrect passcode');
      setShake(true);
      setInput('');
      setTimeout(() => { setShake(false); setError(''); }, 2200);
    } finally {
      setBusy(false);
    }
  }, [busy, input, onSuccess]);

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

        <button type="button" className="pass-btn" onClick={() => { haptic(); attempt(); }} disabled={busy}>
          {busy ? 'Verifying' : 'Unlock'}
        </button>
      </div>

      {mobile && showKb && (
        <RagKeyboard
          onKey={kbAppend}
          onBackspace={kbBack}
          onEnter={attempt}
          onClose={() => setShowKb(false)}
        />
      )}
    </div>
  );
}

/* â”€â”€ CLI Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function CliModal({ onClose }) {
  const mobile = useIsMobile();
  const [history, setHistory]   = useState([]);
  const [input, setInput]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showKb, setShowKb]     = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [step, setStep]         = useState('class');
  const [classNum, setClassNum] = useState(null);
  const [section, setSection]   = useState(null);
  const inputRef  = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    setHistory([{ type: 'sys', text: 'Enter class (1-12), e.g. 5 or 5th' }]);
  }, []);

  useEffect(() => {
    if (mobile) setShowKb(true);
    else inputRef.current?.focus();
  }, [mobile]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history, analyzing]);

  const storeEntry = useCallback(async (text) => {
    const idx = history.length;
    setHistory(h => [...h, { type: 'cmd', text, status: 'uploading' }]);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, class: classNum, section }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed');
      setHistory(h => h.map((e, i) => i === idx ? { ...e, status: 'ok' } : e));
    } catch {
      setHistory(h => h.map((e, i) => i === idx ? { ...e, status: 'err' } : e));
    }
  }, [history.length, classNum, section]);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || busy || analyzing) return;
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

  const handleImageCapture = useCallback(async (extracted) => {
    setCameraOpen(false);
    setAnalyzing(true);
    setHistory(h => [...h, { type: 'sys', text: '[Image Ingest] Local OCR complete.' }]);

    try {
      await new Promise(resolve => setTimeout(resolve, 260));
      setHistory(h => [
        ...h,
        { type: 'ocr', text: extracted || '(no text detected)' },
      ]);

      if (step === 'data' && extracted) {
        await storeEntry(extracted);
      } else if (extracted && step !== 'data') {
        setHistory(h => [...h, {
          type: 'sys',
          text: 'Complete class & section setup before storing image text.',
        }]);
      }
    } catch (err) {
      setHistory(h => [...h, { type: 'sys', text: `[!!] Image analysis failed: ${err.message}` }]);
    } finally {
      setAnalyzing(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [step, storeEntry]);

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
                {entry.status === 'uploading' && <AsciiProgress />}
                {entry.status === 'ok' && (
                  <div className="cli-ok">[==========] 100% done - stored in Class {classNum}, Section {section}.</div>
                )}
                {entry.status === 'err' && (
                  <div className="cli-err">[!!] Storage failed. Check connection and retry.</div>
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
              {analyzing ? 'ANALYZING...' : busy ? 'UPLOADING...' : 'READY'}
            </span>
            <div className="cli-actions">
              <button
                type="button"
                className="cli-action-btn"
                onClick={() => { haptic(); setCameraOpen(true); }}
                disabled={busy || analyzing}
              >
                Image Ingest
              </button>
              <button
                type="button"
                className="cli-action-btn cli-action-btn--primary"
                onClick={() => { haptic(); submit(); }}
                disabled={busy || analyzing}
              >
                ENTER
              </button>
            </div>
          </div>
        </div>
      </div>

      {mobile && showKb && !cameraOpen && (
        <RagKeyboard
          onKey={kbAppend}
          onBackspace={kbBack}
          onEnter={submit}
          onClose={() => setShowKb(false)}
        />
      )}

      {cameraOpen && (
        <CameraCapture
          onCapture={handleImageCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </>
  );
}

/* â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function MainPage({ locked }) {
  const [cliOpen, setCliOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const clock = useClock();

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
            haptic();
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
        <button type="button" className="main-footer-link">Documentation</button>
        <span className="main-footer-brand">
          By using RAG Software you agree with its{' '}
          <button type="button" className="main-footer-inline" onClick={() => setTermsOpen(true)}>
            Terms & Conditions
          </button>
        </span>
        <span className="main-footer-clock">{clock}</span>
      </div>

      {termsOpen && (
        <div className="policy-panel">
          <div className="policy-card">
            <div className="policy-titlebar">
              <span>Terms & Conditions</span>
              <button type="button" onClick={() => setTermsOpen(false)}>x</button>
            </div>
            <div className="policy-empty" />
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
        <div className="policy-empty" />
        <button type="button" className="policy-agree" onClick={() => { haptic(); onAgree(); }}>
          I Agree
        </button>
      </div>
    </div>
  );
}

/* â”€â”€ App â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  return (
    <>
      <MainPage locked={!authed} />
      {!authed && <PasscodeModal onSuccess={() => { setAuthed(true); setPrivacyOpen(true); }} />}
      {authed && privacyOpen && <PrivacyPopup onAgree={() => setPrivacyOpen(false)} />}
    </>
  );
}
