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

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'Invalid form data' }, 400);
  }

  const image = formData.get('image');
  if (!image) {
    return json({ error: 'No image provided' }, 400);
  }

  const ocrForm = new FormData();
  ocrForm.append('file', image, 'capture.png');
  ocrForm.append('language', 'eng');
  ocrForm.append('OCREngine', '2');
  ocrForm.append('isOverlayRequired', 'false');

  try {
    const ocrRes = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'apikey': apiKey },
      body: ocrForm,
    });

    const ocrData = await ocrRes.json();
    if (ocrData.IsErroredOnProcessing) {
      return json({ error: ocrData.ErrorMessage?.[0]?.ErrorMessage || 'OCR processing failed' }, 422);
    }

    const text = (ocrData.ParsedResults?.[0]?.ParsedText || '').trim();
    return json({ text: text || '(no text detected)' });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
