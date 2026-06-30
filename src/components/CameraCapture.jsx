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
  const [status, setStatus] = useState('Align text inside the guide.');
  const [result, setResult] = useState('');
  const [extracting, setExtracting] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async (mode) => {
    stopStream();
    setReady(false);
    setError('');
    setStatus('Starting camera...');
    setResult('');
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
      setStatus('Align text inside the guide.');
    } catch {
      setError('Camera access denied or unavailable.');
      setStatus('Camera unavailable.');
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

  const extractText = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const Tesseract = window.Tesseract;
    if (!video || !canvas || !ready || extracting) return;
    if (!Tesseract) {
      setStatus('OCR engine is still loading. Try again in a moment.');
      return;
    }

    haptic(16);
    setExtracting(true);
    setResult('');
    setStatus('Capturing full-resolution frame...');

    const width = video.videoWidth;
    const height = video.videoHeight;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (facing === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114);
      const contrast = gray > 150 ? 255 : 0;
      data[i] = contrast;
      data[i + 1] = contrast;
      data[i + 2] = contrast;
    }
    ctx.putImageData(imageData, 0, 0);

    try {
      const response = await Tesseract.recognize(canvas, 'eng', {
        logger: message => {
          if (message.status) {
            const progress = Number.isFinite(message.progress) ? ` ${Math.round(message.progress * 100)}%` : '';
            setStatus(`${message.status}${progress}`);
          }
        },
      });
      const text = response?.data?.text || '';
      setResult(text || '(no text detected)');
      setStatus('Extraction complete.');
      haptic([10, 30, 10]);
      stopStream();
      onCapture?.(text);
    } catch (err) {
      setStatus(`Extraction failed: ${err.message}`);
      haptic([20, 40, 20]);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="rag-cam">
      <div className="rag-cam-header">
        <button type="button" className="rag-cam-cancel" onClick={() => { haptic(); stopStream(); onClose(); }}>Cancel</button>
        <span className="rag-cam-title">RAG Image Analysis</span>
        <div style={{ width: 56 }} />
      </div>

      <div className="rag-cam-preview-wrap">
        {error ? (
          <div className="rag-cam-error">{error}</div>
        ) : (
          <>
            <video ref={videoRef} className="rag-cam-video" playsInline muted />
            <div className="rag-cam-guide" aria-hidden="true" />
          </>
        )}
      </div>

      <div className="rag-cam-output">
        <div className="rag-cam-status">{status}</div>
        <pre className="rag-cam-text">{result}</pre>
      </div>

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

        <button type="button" className="rag-cam-extract" onClick={extractText} disabled={!ready || extracting} aria-label="Extract Text">
          {extracting ? 'Extracting' : 'Extract Text'}
        </button>

        <div style={{ width: 54 }} />
      </div>

      <canvas ref={canvasRef} className="rag-cam-canvas" aria-hidden="true" />
    </div>
  );
}
