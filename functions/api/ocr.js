const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const apiKey = env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    return json({ error: 'OCR_SPACE_API_KEY not configured' }, 500);
  }

  let imageBase64;
  let size;
  try {
    const body = await request.json();
    imageBase64 = typeof body.image === 'string' ? body.image.trim() : '';
    size = body.size || 0;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!imageBase64) {
    return json({ error: 'No image provided' }, 400);
  }

  if (imageBase64.length < 500) {
    return json({ error: 'Image data too small or truncated', length: imageBase64.length }, 400);
  }

  try {
    const formData = new FormData();
    formData.append('base64Image', imageBase64);
    formData.append('language', 'eng');
    formData.append('OCREngine', '3');
    formData.append('isOverlayRequired', 'false');

    const ocrRes = await fetch(`https://api.ocr.space/parse/image?apikey=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      body: formData,
    });

    const ocrStatus = ocrRes.status;
    let ocrRaw;
    try {
      ocrRaw = await ocrRes.text();
    } catch {
      ocrRaw = '(unreadable)';
    }

    let ocrData;
    try {
      ocrData = JSON.parse(ocrRaw);
    } catch {
      return json({ error: 'OCR.Space returned non-JSON', status: ocrStatus, raw: ocrRaw.slice(0, 2000) }, 502);
    }

    return json({
      text: '',
      _debug: { ocrStatus, ocrRaw: ocrRaw.slice(0, 3000), imageSize: imageBase64.length },
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
