import { useCallback, useRef, useState } from 'react';

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

function ShiftIcon({ locked }) {
  return (
    <svg className="rag-kb-shift-icon" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M13 3 4.5 12h4.3v8.5h8.4V12h4.3L13 3Z" />
      {locked && <path className="rag-kb-shift-lock" d="M8.5 23h9" />}
    </svg>
  );
}

export default function RagKeyboard({ onKey, onBackspace, onEnter, onClose }) {
  const [shiftMode, setShiftMode] = useState('off');
  const [numbers, setNumbers] = useState(false);
  const lastShiftTap = useRef(0);

  const shifted = shiftMode !== 'off';

  const press = useCallback((key) => {
    haptic();

    if (key === 'shift') {
      const now = performance.now();
      const isDoubleTap = now - lastShiftTap.current < 330;
      lastShiftTap.current = now;
      setShiftMode(mode => {
        if (isDoubleTap) return mode === 'locked' ? 'off' : 'locked';
        return mode === 'off' ? 'once' : 'off';
      });
      return;
    }

    if (key === 'del') {
      onBackspace?.();
      return;
    }

    if (key === 'ABC') {
      setNumbers(false);
      return;
    }

    const output = shifted && /^[a-z]$/.test(key) ? key.toUpperCase() : key;
    onKey?.(output);
    if (shiftMode === 'once') setShiftMode('off');
  }, [shifted, shiftMode, onKey, onBackspace]);

  const rows = numbers ? NUMBER_ROWS : LETTER_ROWS;

  return (
    <div className="rag-kb" onMouseDown={e => e.preventDefault()} onTouchStart={e => e.stopPropagation()}>
      <div className="rag-kb-keys">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="rag-kb-row"
            style={rowIndex === 1 && !numbers ? { paddingLeft: 14 } : undefined}
          >
            {row.map(key => {
              const label = shifted && /^[a-z]$/.test(key) ? key.toUpperCase() : key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`rag-kb-key${key === 'shift' && shifted ? ' rag-kb-key--active' : ''}${key === 'shift' && shiftMode === 'locked' ? ' rag-kb-key--locked' : ''}${key === 'del' || key === 'shift' || key === 'ABC' ? ' rag-kb-key--wide' : ''}`}
                  onClick={() => press(key)}
                >
                  {key === 'shift' ? <ShiftIcon locked={shiftMode === 'locked'} /> : label}
                </button>
              );
            })}
          </div>
        ))}

        <div className="rag-kb-row rag-kb-row--bottom">
          <button type="button" className="rag-kb-key rag-kb-key--fn" onClick={() => { haptic(); setNumbers(n => !n); }}>
            {numbers ? 'ABC' : '123'}
          </button>
          <button type="button" className="rag-kb-key rag-kb-key--space" onClick={() => { haptic(); onKey?.(' '); }}>
            space
          </button>
          <button type="button" className="rag-kb-key rag-kb-key--fn" onClick={() => { haptic(12); onEnter?.(); }}>
            return
          </button>
        </div>
      </div>

      <div className="rag-kb-footer">
        <span>RAG-keyboard</span>
        {onClose && (
          <button type="button" className="rag-kb-dismiss" onClick={() => { haptic(); onClose(); }}>v</button>
        )}
      </div>
    </div>
  );
}
