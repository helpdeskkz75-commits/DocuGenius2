export async function synthesizeSpeech(text: string, lang: "ru"|"kk"): Promise<Buffer> {
  // Azure/GCP/ElevenLabs — вернуть аудио-буфер
  const provider = process.env.TTS_PROVIDER || 'openai';
  
  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    return await synthesizeWithOpenAI(text, lang);
  }
  
  // Fallback - return empty buffer if no TTS provider configured
  console.warn("No TTS provider configured, returning empty audio buffer");
  return Buffer.from([]);
}

async function synthesizeWithOpenAI(text: string, lang: "ru"|"kk"): Promise<Buffer> {
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: 'alloy', // можно настроить разные голоса для разных языков
        response_format: 'mp3'
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error("TTS synthesis error:", error);
    return Buffer.from([]);
  }
}