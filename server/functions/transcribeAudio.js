const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const OPENROUTER_KEY = process.env.KIMI_API_KEY || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_GEMINI_MODEL = 'google/gemini-2.5-flash';

export default async function transcribeAudio(req, res) {
  try {
    if (!GEMINI_API_KEY && !OPENROUTER_KEY) {
      return res.status(500).json({ error: 'Missing Gemini and OpenRouter API keys' });
    }

    const { audio, mimeType } = req.body;
    if (!audio || typeof audio !== 'string') {
      return res.status(400).json({ error: 'Missing audio payload' });
    }

    const body = {
      system_instruction: {
        parts: [{
          text: 'You are an audio transcription engine. Transcribe the user\'s speech exactly as spoken. Keep the original language. Add normal punctuation and sentence casing when obvious. Return ONLY the transcript text and nothing else. If the audio is empty or unintelligible, return an empty string.',
        }],
      },
      contents: [{
        role: 'user',
        parts: [
          { text: 'Transcribe this audio.' },
          { inline_data: { mime_type: mimeType || 'audio/webm', data: audio } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    };

    const transcribeViaOpenRouter = async () => {
      if (!OPENROUTER_KEY) throw new Error('OpenRouter fallback key missing');
      const audioFormat = (mimeType || 'audio/webm').includes('wav') ? 'wav' : 'webm';
      const orBody = {
        model: OPENROUTER_GEMINI_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Transcribe this audio exactly. Keep original language. Return only transcript text.' },
            { type: 'input_audio', input_audio: { data: audio, format: audioFormat } },
          ],
        }],
        temperature: 0.1,
        max_tokens: 1024,
      };
      const orResp = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENROUTER_KEY}`,
        },
        body: JSON.stringify(orBody),
      });
      if (!orResp.ok) {
        const err = await orResp.text();
        throw new Error(`OpenRouter transcription failed: ${orResp.status} ${err.slice(0, 300)}`);
      }
      const data = await orResp.json();
      const text = (data?.choices?.[0]?.message?.content || '').trim();
      return text;
    };

    if (GEMINI_API_KEY) {
      const resp = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        const data = await resp.json();
        const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        return res.json({ text });
      }

      const errText = await resp.text();
      const unavailable = resp.status === 503 || /UNAVAILABLE|overloaded|high demand|try again later/i.test(errText);
      console.error('Transcribe Gemini API error:', errText);
      if (!unavailable || !OPENROUTER_KEY) {
        return res.status(500).json({ error: 'Transcription request failed' });
      }
    }

    const fallbackText = await transcribeViaOpenRouter();
    return res.json({ text: fallbackText });
  } catch (error) {
    console.error('transcribeAudio error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
