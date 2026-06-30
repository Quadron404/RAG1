import { useCallback, useEffect, useRef, useState } from 'react';

function haptic(strength = 10) {
  navigator.vibrate?.(strength);
}

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [facing, setFacing] = useState('environment');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [captured, setCaptured] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async (mode) => {
    stopStream();
    setReady(false);
    setError('');
    setCaptured(false);
    setAnalyzing(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch {
      setError('Camera access denied or unavailable.');
    }
  }, [stopStream]);

  useEffect(() => {
    startCamera(facing);
    return stopStream;
  }, [facing, startCamera, stopStream]);

  const flip = () => {
    haptic(12);
    setFacing(f => f === 'environment' ? 'user' : 'environment');
  };

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !ready) return;

    haptic(16);
    const width = video.videoWidth || 1920;
    const height = video.videoHeight || 1080;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (facing === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    let base64;
    try {
      base64 = canvas.toDataURL('image/png').split(',')[1];
    } catch {
      base64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
    }

    setCaptured(true);
    stopStream();
    setAnalyzing(true);

    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error + (data.exitCode ? ` (exit code: ${data.exitCode})` : ''));
      }

      haptic([10, 30, 10]);
      onCapture?.(data.text || '');
    } catch (err) {
      haptic([20, 40, 20]);
      onCapture?.(null);
    }
  };

  return (
    <div className="rag-cam">
      <div className="rag-cam-header">
        <div className="rag-cam-header-left">
          <span className="rag-cam-title">RAG Image Analysis</span>
          <span className="rag-cam-version">Version 2.7182.8</span>
        </div>
        {!analyzing && (
          <button type="button" className="rag-cam-cancel" onClick={() => { haptic(); stopStream(); onClose(); }}>Cancel</button>
        )}
      </div>

      <div className="rag-cam-preview-wrap">
        {error ? (
          <div className="rag-cam-error">{error}</div>
        ) : analyzing ? (
          <div className="rag-cam-analyzing">
            <span className="rag-cam-analyzing-text">Analyzing</span>
          </div>
        ) : captured ? null : (
          <video ref={videoRef} className="rag-cam-video" playsInline muted />
        )}
      </div>

      {!captured && !analyzing && (
        <div className="rag-cam-controls">
          <button type="button" className="rag-cam-flip" onClick={flip} aria-label="Flip camera">
            <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <path d="M8.5 9.2a7.4 7.4 0 0 1 11.9 1.6" />
              <path d="M20.8 6.7v4.4h-4.4" />
              <path d="M19.5 18.8A7.4 7.4 0 0 1 7.6 17.2" />
              <path d="M7.2 21.3v-4.4h4.4" />
              <circle cx="14" cy="14" r="3.2" />
            </svg>
          </button>

          <button type="button" className="rag-cam-capture-btn" onClick={capture} disabled={!ready} aria-label="Capture">
            <span className="rag-cam-capture-ring" />
          </button>

          <button type="button" className="rag-cam-extract" onClick={capture} disabled={!ready} aria-label="Extract Text">
            Extract Text
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="rag-cam-canvas" aria-hidden="true" />
    </div>
  );
}
