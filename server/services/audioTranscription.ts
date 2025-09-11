// server/services/audioTranscription.ts
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import fetch from "node-fetch";
import OpenAI from "openai";

type TgGetFileResponse = { ok: boolean; result?: { file_path?: string } };

export async function transcribeTelegramFile(
  fileId: string,
  botToken: string,
): Promise<string | null> {
  if (!fileId || !botToken) return null;

  // 1) meta от Telegram
  const meta = (await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
  ).then((r) => r.json())) as TgGetFileResponse;

  const filePath = meta.result?.file_path;
  if (!filePath) return null;

  // 2) скачиваем во временный файл
  const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const tmpDir = path.join(process.cwd(), "temp");
  await fs.promises.mkdir(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, `${fileId}.bin`);

  const resp = await fetch(url);
  if (!resp.ok || !resp.body) return null;
  await pipeline(resp.body as any, fs.createWriteStream(tmpFile));

  // 3) Whisper: auto | ru | kk
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const model = (process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1").trim();
  const mode = (process.env.OPENAI_TRANSCRIBE_LANGUAGE_MODE || "auto")
    .toLowerCase()
    .trim();

  const payload: any = { file: fs.createReadStream(tmpFile), model };
  if (mode === "ru" || mode === "kk") payload.language = mode;

  try {
    const out: any = await client.audio.transcriptions.create(payload);
    const text: string = (out?.text || "").trim();
    if (process.env.DEBUG_TRANSCRIBE === "true") {
      console.log("[transcribe]", { fileId, mode, model, text });
    }
    return text || null;
  } catch (e) {
    console.error("[transcribeTelegramFile] error:", e);
    return null;
  } finally {
    fs.unlink(tmpFile, () => {});
  }
}

export const audioTranscriptionService = { transcribeTelegramFile };
