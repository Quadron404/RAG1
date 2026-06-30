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
  try {
    const body = await request.json();
    imageBase64 = typeof body.image === 'string' ? body.image.trim() : '';
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!imageBase64) {
    return json({ error: 'No image provided' }, 400);
  }

  const ocrForm = new FormData();
  ocrForm.append('base64Image', imageBase64);
  ocrForm.append('language', 'eng');
  ocrForm.append('OCREngine', '3');
  ocrForm.append('isOverlayRequired', 'false');

  try {
    const ocrRes = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'apikey': apiKey },
      body: ocrForm,
    });

    const ocrData = await ocrRes.json();
    if (ocrData.IsErroredOnProcessing) {
      const errMsg = ocrData.ErrorMessage?.[0]?.ErrorMessage || 'OCR processing failed';
      return json({ error: errMsg, details: ocrData }, 422);
    }

    const text = (ocrData.ParsedResults?.[0]?.ParsedText || '').trim();
    return json({ text: text || '(no text detected)' });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
