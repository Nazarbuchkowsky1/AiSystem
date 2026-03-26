const KIMI_API_KEY = process.env.KIMI_API_KEY || '';
const KIMI_URL = 'https://openrouter.ai/api/v1/chat/completions';

export default async function invokeLLM(req, res) {
  try {
    const { prompt, response_type, response_json_schema } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
    if (!KIMI_API_KEY) return res.status(500).json({ error: 'No LLM API key configured' });

    const body = {
      model: 'moonshotai/kimi-k2.5',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Output ONLY valid JSON when asked for JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    };

    if (response_json_schema || response_type === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const resp = await fetch(KIMI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KIMI_API_KEY}` },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: `LLM error: ${resp.status}` });
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || '';

    try {
      const parsed = JSON.parse(text);
      return res.json(parsed);
    } catch {
      return res.json({ text });
    }
  } catch (error) {
    console.error('invokeLLM error:', error);
    res.status(500).json({ error: error.message });
  }
}
