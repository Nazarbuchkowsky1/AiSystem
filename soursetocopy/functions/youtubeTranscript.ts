import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchTranscript(videoId) {
  // Fetch the YouTube page to get caption tracks
  const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  const html = await res.text();

  // Extract title
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'Unknown';

  // Find captions URL from the page source
  const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
  if (!captionMatch) {
    throw new Error('No captions found for this video. The video may not have subtitles enabled.');
  }

  const captionTracks = JSON.parse(captionMatch[1]);
  if (!captionTracks || captionTracks.length === 0) {
    throw new Error('No caption tracks available for this video.');
  }

  // Prefer English, fall back to first available, prefer manual over auto
  let track = captionTracks.find(t => t.languageCode === 'en' && t.kind !== 'asr');
  if (!track) track = captionTracks.find(t => t.languageCode === 'en');
  if (!track) track = captionTracks.find(t => t.kind !== 'asr');
  if (!track) track = captionTracks[0];

  const captionUrl = track.baseUrl;
  const captionRes = await fetch(captionUrl);
  const captionXml = await captionRes.text();

  // Parse XML transcript
  const lines = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/g;
  let match;
  while ((match = regex.exec(captionXml)) !== null) {
    const text = match[3]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, '')
      .trim();
    if (text) lines.push(text);
  }

  return {
    title,
    videoId,
    language: track.languageCode,
    transcript: lines.join(' '),
    lineCount: lines.length,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await req.json();
    if (!url) {
      return Response.json({ error: 'Missing YouTube URL' }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return Response.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    const result = await fetchTranscript(videoId);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});