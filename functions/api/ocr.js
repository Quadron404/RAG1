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
    formData.append('apikey', apiKey);
    formData.append('base64Image', imageBase64);
    formData.append('language', 'eng');
    formData.append('OCREngine', '3');
    formData.append('isOverlayRequired', 'false');

    const ocrRes = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    const ocrData = await ocrRes.json();
    const exitCode = ocrData.OCRExitCode;
    const parsed = ocrData.ParsedResults?.[0];
    const text = (parsed?.ParsedText || '').trim();
    const errorMsg = ocrData.ErrorMessage?.[0]?.ErrorMessage || '';
    const parsedCount = ocrData.ParsedResults?.length || 0;
    const fileExitCode = parsed?.FileParseExitCode;
    const errDetails = parsed?.ErrorDetails || '';

    if (ocrData.IsErroredOnProcessing || errorMsg) {
      return json({
        error: errorMsg || 'OCR processing failed',
        exitCode,
        parsedCount,
        fileParseExitCode: fileExitCode,
        errDetails,
      }, 422);
    }

    return json({
      text,
      exitCode,
      parsedCount,
      fileParseExitCode: fileExitCode,
      imageSize: imageBase64.length,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
