const json = (statusCode, body) => new Response(JSON.stringify(body), { status: statusCode, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

export default async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'POST only' });
  const { imageDataUrl, projectId = null } = await request.json();
  if (!imageDataUrl?.startsWith('data:image/')) return json(400, { error: 'imageDataUrl is required' });
  if (!process.env.OPENAI_API_KEY) return json(500, { error: 'Missing OPENAI_API_KEY in Netlify environment variables' });
  const prompt = `Analyze this interior/product display image for a materials visualization workflow. Return valid JSON only with this shape: {"planes":[{"name":"floor|wall|table|object","description":"...","confidence":0.0}],"visual_profile":{"colors":[],"materials":[],"style":"..."},"recommendations":[{"name":"...","category":"...","reason":"...","confidence":0.0}]}. Do not claim pixel-perfect segmentation; describe likely visible planes and objects. Use Thai descriptions where practical.`;
  const ai = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_VISION_MODEL || 'gpt-5.6-luna', input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: imageDataUrl, detail: 'high' }] }] }) });
  if (!ai.ok) return json(ai.status, { error: 'OpenAI analysis failed', detail: await ai.text() });
  const payload = await ai.json();
  let analysis;
  try { analysis = JSON.parse(payload.output_text); } catch { return json(502, { error: 'OpenAI returned non-JSON output', raw: payload.output_text }); }
  let materials = [];
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/materials?select=*&is_active=eq.true&limit=100`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
    if (r.ok) materials = await r.json();
  }
  const matched = materials.sort((a,b) => Number(b.match_score || 0) - Number(a.match_score || 0)).slice(0, 8);
  return json(200, { analysis, materials: matched, source: materials.length ? 'supabase' : 'openai-only', projectId });
};
