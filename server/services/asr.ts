export async function transcribeAudio(urlOrBuffer: string|Buffer, langHint?: "ru"|"kk"): Promise<string> {
  // Whisper API/GCP — получить текст
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is required for ASR");
  }

  try {
    // If it's a URL, fetch the audio buffer first
    let audioBuffer: Buffer;
    if (typeof urlOrBuffer === 'string') {
      const response = await fetch(urlOrBuffer);
      audioBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      audioBuffer = urlOrBuffer;
    }

    // Use OpenAI Whisper API for transcription
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer]), 'audio.ogg');
    formData.append('model', 'whisper-1');
    if (langHint) {
      formData.append('language', langHint === 'kk' ? 'kk' : 'ru');
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`ASR API error: ${response.status}`);
    }

    const result = await response.json();
    return result.text || "";
  } catch (error) {
    console.error("ASR transcription error:", error);
    return "";
  }
}