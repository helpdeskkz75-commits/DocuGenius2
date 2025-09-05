type Lang = 'ru' | 'kz';
export type FunnelStep = 0 | 1 | 2 | 3;

export interface FunnelState {
  step: FunnelStep;
  lang: Lang;
  answers: Record<string, string>;
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
    this.sessions.set(chatId, { step: 1, lang, answers: {} });
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
}

export const funnelService = new FunnelService();
