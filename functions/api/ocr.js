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
    const params = new URLSearchParams();
    params.set('base64Image', `data:image/png;base64,${imageBase64}`);
    params.set('language', 'eng');
    params.set('OCREngine', '3');

    const ocrRes = await fetch(`https://api.ocr.space/parse/image?apikey=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const ocrData = await ocrRes.json();

    if (ocrData.IsErroredOnProcessing) {
      return json({
        error: ocrData.ErrorMessage?.[0]?.ErrorMessage || 'OCR processing failed',
        exitCode: ocrData.OCRExitCode,
      }, 422);
    }

    const parsed = ocrData.ParsedResults?.[0];
    const text = (parsed?.ParsedText || '').trim();

    return json({
      text,
      exitCode: ocrData.OCRExitCode,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
