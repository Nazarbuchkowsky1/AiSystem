import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

// Microphone: speech-to-text always uses Gemini (audio-in support). Agent reply to voice uses Kimi (see agent-chat isVoiceMessage).
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!GEMINI_API_KEY) {
      return Response.json({ error: "Missing Gemini API key" }, { status: 500 });
    }

    const { audio, mimeType } = await req.json();
    if (!audio || typeof audio !== "string") {
      return Response.json({ error: "Missing audio payload" }, { status: 400 });
    }

    const body = {
      system_instruction: {
        parts: [{
          text: "You are an audio transcription engine. Transcribe the user's speech exactly as spoken. Keep the original language. Add normal punctuation and sentence casing when obvious. Return ONLY the transcript text and nothing else. If the audio is empty or unintelligible, return an empty string.",
        }],
      },
      contents: [{
        role: "user",
        parts: [
          { text: "Transcribe this audio." },
          {
            inline_data: {
              mime_type: mimeType || "audio/webm",
              data: audio,
            },
          },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    };

    const resp = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Transcribe Gemini API error:", errText);
      return Response.json({ error: "Transcription request failed" }, { status: 500 });
    }

    const data = await resp.json();
    const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    return Response.json({ text });
  } catch (error) {
    console.error("transcribeAudio error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
