import { detectLang } from "./langDetect";
import TelegramBot from "node-telegram-bot-api";
import { getWAClient } from "../integrations/whatsapp/factory";

export type NormalizedMessage = {
  tenantKey: string;
  chatId: string;
  channel: "tg"|"wa";
  lang: "ru"|"kk";
  kind: "text"|"voice"|"audio"|"image";
  text?: string;
  mediaUrl?: string;
};

// Initialize bot instance for file operations
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN || "", { polling: false });

// Helper function to get Telegram file URL from file_id
async function getTelegramFileUrl(fileId: string): Promise<string | undefined> {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.warn("[normalizer] TELEGRAM_BOT_TOKEN not set, cannot resolve file URL");
      return undefined;
    }
    
    const file = await bot.getFile(fileId);
    if (file.file_path) {
      return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    }
    return undefined;
  } catch (error) {
    console.error("[normalizer] Failed to get Telegram file URL:", error);
    return undefined;
  }
}

// Helper function to get WhatsApp media URL from media_id
async function getWhatsAppMediaUrl(mediaId: string): Promise<string | undefined> {
  try {
    const waClient = getWAClient();
    return await waClient.getMediaUrl(mediaId);
  } catch (error) {
    console.error("[normalizer] Failed to get WhatsApp media URL:", error);
    return undefined;
  }
}

export async function normalizeIncoming(req: any): Promise<NormalizedMessage> {
  // распарсить webhook TG/WA → определить tenantKey, channel, chatId, kind, text/mediaUrl
  // детект языка (ru/kk) по тексту; для голоса заполним позже после ASR
  // вернуть NormalizedMessage
  
  const body = req.body;
  const params = req.params;
  
  // Telegram webhook
  if (req.path.includes('/webhook/tg/') && body.message) {
    const message = body.message;
    const tenantKey = params.tenantKey;
    const chatId = message.chat.id.toString();
    
    let kind: "text"|"voice"|"audio"|"image" = "text";
    let text = message.text || "";
    let mediaUrl: string | undefined;
    
    // Determine message type and get proper file URLs
    if (message.voice) {
      kind = "voice";
      mediaUrl = await getTelegramFileUrl(message.voice.file_id);
    } else if (message.audio) {
      kind = "audio";
      mediaUrl = await getTelegramFileUrl(message.audio.file_id);
    } else if (message.photo && message.photo.length > 0) {
      kind = "image";
      // Get largest photo size
      const largestPhoto = message.photo[message.photo.length - 1];
      mediaUrl = await getTelegramFileUrl(largestPhoto.file_id);
      text = message.caption || "";
    } else if (message.document && message.document.mime_type?.startsWith('audio/')) {
      kind = "audio";
      mediaUrl = await getTelegramFileUrl(message.document.file_id);
    }
    
    // Detect language from text (for voice, will be filled after ASR)
    const lang = text ? detectLang(text) : "ru";
    
    return {
      tenantKey,
      chatId,
      channel: "tg",
      lang,
      kind,
      text,
      mediaUrl
    };
  }
  
  // WhatsApp webhook
  if (req.path.includes('/webhook/wa') && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
    const message = body.entry[0].changes[0].value.messages[0];
    const metadata = body.entry[0].changes[0].value.metadata;
    
    // Resolve tenant by phone_id/metadata
    let tenantKey = "default"; // Default fallback
    const phoneId = metadata?.phone_number_id || metadata?.display_phone_number;
    
    if (phoneId) {
      try {
        const { storage } = await import("../storage");
        const tenants = await storage.getTenants();
        const tenant = tenants.find(t => t.waPhoneId === phoneId && t.active);
        if (tenant) {
          tenantKey = tenant.key;
        }
      } catch (error) {
        console.warn("[normalizer] Failed to resolve tenant from WhatsApp phone ID:", error);
      }
    }
    
    const chatId = message.from;
    
    let kind: "text"|"voice"|"audio"|"image" = "text";
    let text = "";
    let mediaUrl: string | undefined;
    
    if (message.type === "text") {
      text = message.text.body;
    } else if (message.type === "audio") {
      kind = "audio";
      mediaUrl = await getWhatsAppMediaUrl(message.audio.id);
    } else if (message.type === "voice") {
      kind = "voice";
      mediaUrl = await getWhatsAppMediaUrl(message.voice.id);
    } else if (message.type === "image") {
      kind = "image";
      mediaUrl = await getWhatsAppMediaUrl(message.image.id);
      text = message.image.caption || "";
    }
    
    const lang = text ? detectLang(text) : "ru";
    
    return {
      tenantKey,
      chatId,
      channel: "wa",
      lang,
      kind,
      text,
      mediaUrl
    };
  }
  
  // Default fallback
  return {
    tenantKey: "default",
    chatId: "unknown",
    channel: "tg",
    lang: "ru",
    kind: "text",
    text: ""
  };
}