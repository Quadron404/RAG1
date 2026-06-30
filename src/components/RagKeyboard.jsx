import { useCallback, useRef, useState, memo } from 'react';

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

const BOTTOM_ROW = [
  { key: '123', label: '123', fn: true },
  { key: 'space', label: 'space', space: true },
  { key: 'return', label: 'return', fn: true },
];

function haptic(strength = 8) {
  navigator.vibrate?.(strength);
}

function ShiftIcon({ locked }) {
  return (
    <svg className="rag-kb-shift-icon" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M13 3 4.5 12h4.3v8.5h8.4V12h4.3L13 3Z" />
      {locked && <path className="rag-kb-shift-lock" d="M8.5 23h9" />}
    </svg>
  );
}

const MemoShiftIcon = memo(ShiftIcon);

function RagKeyboardInner({ onKey, onBackspace, onEnter, onClose, shiftMode, numbers, onShift, onNumbers }) {
  const shifted = shiftMode !== 'off';
  const rows = numbers ? NUMBER_ROWS : LETTER_ROWS;

  const handlePointer = useCallback((e, key) => {
    e.preventDefault();
    haptic();

    if (key === 'shift') { onShift(); return; }
    if (key === 'del') { onBackspace?.(); return; }
    if (key === 'ABC') { onNumbers?.(); return; }
    if (key === '123') { onNumbers?.(); return; }

    const output = shifted && /^[a-z]$/.test(key) ? key.toUpperCase() : key;
    onKey?.(output);
    if (shiftMode === 'once') onShift?.();
  }, [shifted, shiftMode, onKey, onBackspace, onShift, onNumbers]);

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
              const cls = [
                'rag-kb-key',
                (key === 'del' || key === 'shift' || key === 'ABC') && 'rag-kb-key--wide',
                key === 'shift' && shifted && 'rag-kb-key--active',
                key === 'shift' && shiftMode === 'locked' && 'rag-kb-key--locked',
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={key}
                  type="button"
                  className={cls}
                  onPointerDown={e => handlePointer(e, key)}
                >
                  {key === 'shift' ? <MemoShiftIcon locked={shiftMode === 'locked'} /> : label}
                </button>
              );
            })}
          </div>
        ))}

        <div className="rag-kb-row rag-kb-row--bottom">
          <button type="button" className="rag-kb-key rag-kb-key--fn" onPointerDown={e => { e.preventDefault(); haptic(); onNumbers?.(); }}>
            {numbers ? 'ABC' : '123'}
          </button>
          <button type="button" className="rag-kb-key rag-kb-key--space" onPointerDown={e => { e.preventDefault(); haptic(); onKey?.(' '); }}>
            space
          </button>
          <button type="button" className="rag-kb-key rag-kb-key--fn" onPointerDown={e => { e.preventDefault(); haptic(12); onEnter?.(); }}>
            return
          </button>
        </div>
      </div>

      <div className="rag-kb-footer">
        <span>RAG-keyboard</span>
        {onClose && (
          <button type="button" className="rag-kb-dismiss" onPointerDown={e => { e.preventDefault(); haptic(); onClose(); }}>v</button>
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

  const onShift = useCallback(() => {
    const now = performance.now();
    const isDoubleTap = now - lastShiftTap.current < 330;
    lastShiftTap.current = now;
    setShiftMode(mode => {
      if (isDoubleTap) return mode === 'locked' ? 'off' : 'locked';
      return mode === 'off' ? 'once' : 'off';
    });
  }, []);

  const onNumbers = useCallback(() => {
    setNumbers(n => !n);
  }, []);

  return (
    <MemoRagKeyboardInner
      onKey={onKey}
      onBackspace={onBackspace}
      onEnter={onEnter}
      onClose={onClose}
      shiftMode={shiftMode}
      numbers={numbers}
      onShift={onShift}
      onNumbers={onNumbers}
    />
  );
}
