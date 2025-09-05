import { generateAIResponse } from './openai';

type Lang = 'ru' | 'kz';
export type FunnelStep = 0 | 1 | 2 | 3;

export interface FunnelState {
  step: FunnelStep;
  lang: Lang;
  answers: Record<string, string>;
  conversationHistory: Array<{role: 'user' | 'assistant', content: string}>;
}

const PROMPTS: Record<Lang, [string, string, string]> = {
  ru: [
    "Что именно вам нужно? (материал/товар/марка)",
    "Уточните объём и параметры (кол-во, размеры, сопутствующие требования)",
    "Есть ли ориентир по бюджету и срокам?"
  ],
  kz: [
    "Нақты не қажет? (материал/тауар/марка)",
    "Көлемі мен параметрлерін нақтылаңыз (саны, өлшемі, қосымша талаптар)",
    "Бюджет пен мерзім бойынша бағдар бар ма?"
  ],
};

const SUMMARY: Record<Lang, string> = {
  ru: "Резюме запроса:\n- Что: {what}\n- Параметры: {spec}\n- Бюджет/срок: {budget}\n\nГотов предложить 1–3 варианта из каталога. Продолжим?",
  kz: "Сұраныс қорытындысы:\n- Не: {what}\n- Параметрлер: {spec}\n- Бюджет/мерзім: {budget}\n\nКаталогтан 1–3 нұсқа ұсына аламын. Жалғастырамыз ба?",
};

export class FunnelService {
  sessions = new Map<any, FunnelState>();

  start(chatId: any, lang: Lang): string {
    this.sessions.set(chatId, { step: 1, lang, answers: {}, conversationHistory: [] });
    return PROMPTS[lang][0];
  }

  has(chatId: any): boolean {
    return this.sessions.has(chatId);
  }

  next(chatId: any, text: string): string {
    const s = this.sessions.get(chatId);
    if (!s) return "";
    if (s.step === 1) {
      s.answers.what = text;
      s.step = 2;
      return PROMPTS[s.lang][1];
    } else if (s.step === 2) {
      s.answers.spec = text;
      s.step = 3;
      return PROMPTS[s.lang][2];
    } else {
      s.answers.budget = text;
      const msg = SUMMARY[s.lang]
        .replace("{what}", s.answers.what || "—")
        .replace("{spec}", s.answers.spec || "—")
        .replace("{budget}", s.answers.budget || "—");
      this.sessions.delete(chatId);
      return msg;
    }
  }

  cancel(chatId: any) {
    this.sessions.delete(chatId);
  }

  async generateAIResponse(chatId: any, message: string): Promise<string> {
    const session = this.sessions.get(chatId);
    if (!session) return "";

    try {
      // Add user message to history
      session.conversationHistory.push({ role: 'user', content: message });

      // Get AI config from environment or defaults
      const aiConfig = {
        industry: process.env.AI_INDUSTRY || 'retail',
        personality: process.env.AI_PERSONALITY || 'professional',
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1000'),
        contextMemory: process.env.AI_CONTEXT_MEMORY !== 'false'
      };

      const aiResponse = await generateAIResponse(message, session.conversationHistory, aiConfig);
      
      // Add AI response to history
      session.conversationHistory.push({ role: 'assistant', content: aiResponse });

      // Keep history manageable (last 20 messages)
      if (session.conversationHistory.length > 20) {
        session.conversationHistory = session.conversationHistory.slice(-20);
      }

      return aiResponse;
    } catch (error: any) {
      console.error('AI response error:', error);
      // Fallback to basic response
      if (session.lang === 'kz') {
        return 'Кешіріңіз, қазір жауап бере алмаймын. Менеджермен байланысуға тырысыңыз.';
      }
      return 'Извините, не могу ответить сейчас. Попробуйте связаться с менеджером.';
    }
  }
}

export const funnelService = new FunnelService();
