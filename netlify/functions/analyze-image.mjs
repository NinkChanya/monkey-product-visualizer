const json = (statusCode, body) => new Response(JSON.stringify(body), { status: statusCode, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

export default async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'POST only' });
  const { imageDataUrl, projectId = null } = await request.json();
  if (!imageDataUrl?.startsWith('data:image/')) return json(400, { error: 'imageDataUrl is required' });
  if (!process.env.GEMINI_API_KEY) return json(500, { error: 'Missing GEMINI_API_KEY in Netlify environment variables' });
  const prompt = `Analyze this interior/product display image for a materials visualization workflow. Return valid JSON only with this shape: {"planes":[{"name":"floor|wall|table|object","description":"...","confidence":0.0}],"visual_profile":{"colors":[],"materials":[],"style":"..."},"recommendations":[{"name":"...","category":"...","reason":"...","confidence":0.0}]}. Do not claim pixel-perfect segmentation; describe likely visible planes and objects. Use Thai descriptions where practical.`;
  const model = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
  const ai = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: imageDataUrl.match(/^data:(image\/[^;]+);/)?.[1] || 'image/jpeg', data: imageDataUrl.split(',')[1] } }] }], generationConfig: { responseMimeType: 'application/json' } }) });
  if (!ai.ok) return json(ai.status, { error: 'Gemini analysis failed', detail: await ai.text() });
  const payload = await ai.json();
  let analysis;
  const outputText = payload.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  try { analysis = JSON.parse(outputText); } catch { return json(502, { error: 'Gemini returned non-JSON output', raw: outputText }); }
  let materials = [];
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/materials?select=*&is_active=eq.true&limit=100`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
    if (r.ok) materials = await r.json();
  }
  const matched = materials.sort((a,b) => Number(b.match_score || 0) - Number(a.match_score || 0)).slice(0, 8);
  return json(200, { analysis, materials: matched, source: materials.length ? 'supabase' : 'gemini-only', projectId });
};
