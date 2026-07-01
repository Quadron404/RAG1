import { useCallback, useRef, useState, memo, useEffect } from 'react';

const LETTER_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'del'],
];

const NUMBER_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
  ['ABC', '.', ',', '?', '!', "'", 'del'],
];

function haptic(strength = 8) {
  navigator.vibrate?.(strength);
}

function RagKeyboardInner({ stableOnKey, stableOnBackspace, stableOnEnter, stableOnClose, shiftMode, numbers, onShift, onNumbers }) {
  const shifted = shiftMode !== 'off';
  const rows = numbers ? NUMBER_ROWS : LETTER_ROWS;

  return (
    <div className="rag-kb" onPointerDown={e => e.preventDefault()}>
      <div className="rag-kb-keys">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="rag-kb-row"
            style={rowIndex === 1 && !numbers ? { paddingLeft: 14 } : undefined}
          >
            {row.map(key => {
              const label = shifted && /^[a-z]$/.test(key) ? key.toUpperCase() : key;
              const isShift = key === 'shift';
              const cls = [
                'rag-kb-key',
                (key === 'del' || isShift || key === 'ABC') && 'rag-kb-key--wide',
                isShift && shifted && 'rag-kb-key--active',
                isShift && shiftMode === 'locked' && 'rag-kb-key--locked',
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={key}
                  type="button"
                  className={cls}
                  onPointerDown={e => {
                    e.preventDefault();
                    haptic();
                    if (key === 'shift') { onShift(); return; }
                    if (key === 'del') { stableOnBackspace(); return; }
                    if (key === 'ABC' || key === '123') { onNumbers(); return; }
                    const output = shifted && /^[a-z]$/.test(key) ? key.toUpperCase() : key;
                    stableOnKey(output);
                    if (shiftMode === 'once') onShift();
                  }}
                >
                  {isShift ? (
                    <svg className="rag-kb-shift-icon" viewBox="0 0 26 26" aria-hidden="true">
                      <path d="M13 3 4.5 12h4.3v8.5h8.4V12h4.3L13 3Z" />
                      {shiftMode === 'locked' && <path className="rag-kb-shift-lock" d="M8.5 23h9" />}
                    </svg>
                  ) : label}
                </button>
              );
            })}
          </div>
        ))}

        <div className="rag-kb-row rag-kb-row--bottom">
          <button type="button" className="rag-kb-key rag-kb-key--fn" onPointerDown={e => { e.preventDefault(); haptic(); onNumbers(); }}>
            {numbers ? 'ABC' : '123'}
          </button>
          <button type="button" className="rag-kb-key rag-kb-key--space" onPointerDown={e => { e.preventDefault(); haptic(); stableOnKey(' '); }}>
            space
          </button>
          <button type="button" className="rag-kb-key rag-kb-key--fn" onPointerDown={e => { e.preventDefault(); haptic(12); stableOnEnter(); }}>
            return
          </button>
        </div>
      </div>

      <div className="rag-kb-footer">
        <span>RAG-keyboard</span>
        {stableOnClose && (
          <button type="button" className="rag-kb-dismiss" onPointerDown={e => { e.preventDefault(); haptic(); stableOnClose(); }}>v</button>
        )}
      </div>
    </div>
  );
}

const MemoRagKeyboardInner = memo(RagKeyboardInner);

export default function RagKeyboard({ onKey, onBackspace, onEnter, onClose }) {
  const [shiftMode, setShiftMode] = useState('off');
  const [numbers, setNumbers] = useState(false);
  const lastShiftTap = useRef(0);

  const onKeyRef = useRef(onKey);
  const onBackspaceRef = useRef(onBackspace);
  const onEnterRef = useRef(onEnter);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onKeyRef.current = onKey; });
  useEffect(() => { onBackspaceRef.current = onBackspace; });
  useEffect(() => { onEnterRef.current = onEnter; });
  useEffect(() => { onCloseRef.current = onClose; });

  const stableOnKey = useCallback(ch => onKeyRef.current?.(ch), []);
  const stableOnBackspace = useCallback(() => onBackspaceRef.current?.(), []);
  const stableOnEnter = useCallback(() => onEnterRef.current?.(), []);
  const stableOnClose = useCallback(() => onCloseRef.current?.(), []);

  useEffect(() => {
    if (!onCloseRef.current) return;
    const handleInteraction = (e) => {
      const kb = document.querySelector('.rag-kb');
      if (!kb || kb.contains(e.target)) return;
      if (e.target.closest('input, textarea, [contenteditable]')) return;
      onCloseRef.current?.();
      document.activeElement?.blur();
    };
    document.addEventListener('touchstart', handleInteraction, { passive: true });
    document.addEventListener('mousedown', handleInteraction, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('mousedown', handleInteraction);
    };
  }, []);

  const onShift = useCallback(() => {
    const now = performance.now();
    const isDoubleTap = now - lastShiftTap.current < 330;
    lastShiftTap.current = now;
    setShiftMode(mode => {
      if (isDoubleTap) return mode === 'locked' ? 'off' : 'locked';
      return mode === 'off' ? 'once' : 'off';
    });
  }, []);

  const onNumbers = useCallback(() => setNumbers(n => !n), []);

  return (
    <MemoRagKeyboardInner
      stableOnKey={stableOnKey}
      stableOnBackspace={stableOnBackspace}
      stableOnEnter={stableOnEnter}
      stableOnClose={stableOnClose}
      shiftMode={shiftMode}
      numbers={numbers}
      onShift={onShift}
      onNumbers={onNumbers}
    />
  );
}
