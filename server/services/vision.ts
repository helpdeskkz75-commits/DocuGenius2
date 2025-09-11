// server/services/vision.ts
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { MediaStorageService } from './mediaStorage';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeImage(imageUrl: string, lang: "ru" | "kk" = "ru"): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("[vision] No OpenAI API key configured");
      return lang === "kk" ? "Сурет анализі қолжетімді емес" : "Анализ изображения недоступен";
    }

    const systemPrompt = lang === "kk" 
      ? "Сіз сурет анализын жасайтын көмекшісіз. Суреттегі нәрселерді, адамдарды, мәтіндерді, заттарды егжей-тегжейлі сипаттаңыз. Қазақ тілінде жауап беріңіз."
      : "Вы помощник по анализу изображений. Опишите детально что изображено на картинке: объекты, людей, текст, предметы. Отвечайте на русском языке.";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Supports vision
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: lang === "kk" ? "Бұл суретте не көрінеді?" : "Что изображено на этой картинке?"
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "auto"
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });

    const analysis = response.choices[0]?.message?.content;
    if (!analysis) {
      return lang === "kk" ? "Сурет анализін жасау мүмкін болмады" : "Не удалось проанализировать изображение";
    }

    return analysis;
  } catch (error) {
    console.error("[vision] Image analysis error:", error);
    return lang === "kk" 
      ? "Сурет анализінде қате орын алды" 
      : "Произошла ошибка при анализе изображения";
  }
}

export async function analyzeImageWithContext(
  imageUrl: string, 
  userText: string, 
  lang: "ru" | "kk" = "ru"
): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("[vision] No OpenAI API key configured");
      return lang === "kk" ? "Сурет анализі қолжетімді емес" : "Анализ изображения недоступен";
    }

    const systemPrompt = lang === "kk"
      ? "Сіз сурет анализын жасайтын көмекшісіз. Пайдаланушының сұрағына сурет мазмұнын ескере отырып жауап беріңіз. Қазақ тілінде жауап беріңіз."
      : "Вы помощник по анализу изображений. Ответьте на вопрос пользователя, анализируя содержимое изображения. Отвечайте на русском языке.";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Supports vision
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userText
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "auto"
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const analysis = response.choices[0]?.message?.content;
    if (!analysis) {
      return lang === "kk" ? "Сурет анализін жасау мүмкін болмады" : "Не удалось проанализировать изображение";
    }

    return analysis;
  } catch (error) {
    console.error("[vision] Contextual image analysis error:", error);
    return lang === "kk" 
      ? "Сурет анализінде қате орын алды" 
      : "Произошла ошибка при анализе изображения";
  }
}

/**
 * Download image from URL to temporary file
 */
async function downloadImageToTemp(imageUrl: string, chatId: string): Promise<{ localPath: string; fileName: string } | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`[vision] Failed to download image: ${response.status}`);
      return null;
    }

    // Create temp directory
    const tempDir = path.join(process.cwd(), "temp");
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const ext = ".jpg"; // Default to jpg, could be enhanced to detect actual format
    const fileName = `image_${chatId}_${timestamp}${ext}`;
    const localPath = path.join(tempDir, fileName);

    // Download file
    const buffer = await response.arrayBuffer();
    await fs.promises.writeFile(localPath, Buffer.from(buffer));

    console.log(`[vision] Downloaded image: ${fileName}`);
    return { localPath, fileName };

  } catch (error) {
    console.error(`[vision] Download error:`, error);
    return null;
  }
}

/**
 * Enhanced version of analyzeImage that downloads, analyzes, stores, and cleans up
 */
export async function analyzeImageWithStorage(
  imageUrl: string,
  tenantKey: string,
  chatId: string,
  lang: "ru" | "kk" = "ru"
): Promise<string> {
  let tempFile: string | null = null;
  
  try {
    // First perform the analysis using the existing function
    const analysis = await analyzeImage(imageUrl, lang);
    
    // If analysis failed, return early
    if (!analysis || analysis.includes("недоступен") || analysis.includes("қолжетімді емес")) {
      return analysis;
    }

    // Only proceed with storage if Google Drive is configured
    if (MediaStorageService.isGoogleDriveAvailable()) {
      try {
        // Download image to temp file
        const downloadResult = await downloadImageToTemp(imageUrl, chatId);
        if (downloadResult) {
          tempFile = downloadResult.localPath;
          
          // Upload to Google Drive
          const uploadResult = await MediaStorageService.uploadImageFile(
            tenantKey,
            chatId,
            downloadResult.localPath,
            analysis,
            lang
          );
          
          if (uploadResult.error) {
            console.warn(`[vision] Failed to upload image to Drive: ${uploadResult.error}`);
          } else {
            console.log(`[vision] Successfully uploaded image to Drive for tenant ${tenantKey}`);
          }
        }
      } catch (storageError) {
        console.warn("[vision] Storage operation failed:", storageError);
        // Don't fail the analysis if storage fails - just log the warning
      }
    } else {
      console.debug(`[vision] ${MediaStorageService.getGoogleDriveUnavailableMessage()}, skipping image storage`);
    }
    
    return analysis;
    
  } catch (error) {
    console.error("[vision] Image analysis with storage error:", error);
    return lang === "kk" 
      ? "Сурет анализінде қате орын алды" 
      : "Произошла ошибка при анализе изображения";
  } finally {
    // Clean up temp file
    if (tempFile) {
      await MediaStorageService.cleanupTempFile(tempFile);
    }
  }
}

/**
 * Enhanced version of analyzeImageWithContext that downloads, analyzes, stores, and cleans up
 */
export async function analyzeImageWithContextAndStorage(
  imageUrl: string,
  userText: string,
  tenantKey: string,
  chatId: string,
  lang: "ru" | "kk" = "ru"
): Promise<string> {
  let tempFile: string | null = null;
  
  try {
    // First perform the analysis using the existing function
    const analysis = await analyzeImageWithContext(imageUrl, userText, lang);
    
    // If analysis failed, return early
    if (!analysis || analysis.includes("недоступен") || analysis.includes("қолжетімді емес")) {
      return analysis;
    }

    // Only proceed with storage if Google Drive is configured
    if (MediaStorageService.isGoogleDriveAvailable()) {
      try {
        // Download image to temp file
        const downloadResult = await downloadImageToTemp(imageUrl, chatId);
        if (downloadResult) {
          tempFile = downloadResult.localPath;
          
          // Upload to Google Drive
          const uploadResult = await MediaStorageService.uploadImageFile(
            tenantKey,
            chatId,
            downloadResult.localPath,
            analysis,
            lang
          );
          
          if (uploadResult.error) {
            console.warn(`[vision] Failed to upload image to Drive: ${uploadResult.error}`);
          } else {
            console.log(`[vision] Successfully uploaded image to Drive for tenant ${tenantKey}`);
          }
        }
      } catch (storageError) {
        console.warn("[vision] Storage operation failed:", storageError);
        // Don't fail the analysis if storage fails - just log the warning
      }
    } else {
      console.debug(`[vision] ${MediaStorageService.getGoogleDriveUnavailableMessage()}, skipping image storage`);
    }
    
    return analysis;
    
  } catch (error) {
    console.error("[vision] Contextual image analysis with storage error:", error);
    return lang === "kk" 
      ? "Сурет анализінде қате орын алды" 
      : "Произошла ошибка при анализе изображения";
  } finally {
    // Clean up temp file
    if (tempFile) {
      await MediaStorageService.cleanupTempFile(tempFile);
    }
  }
}