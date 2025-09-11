// server/services/vision.ts
import OpenAI from 'openai';

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