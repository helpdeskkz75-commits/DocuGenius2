// server/services/nlu.ts
// Простой NLU для RU/KZ: выделяет intent, SKU, количество и очищенный поисковый запрос

export type Intent = "calc" | "price" | "find" | "availability" | "unknown";

export interface NLUResult {
  intent: Intent;
  sku?: string;
  qty?: number;
  query?: string; // очищенная товарная часть фразы
}

const PRODUCT_KEYWORDS = [
  "арматура",
  "цемент",
  "гипсокартон",
  "клей",
  "пена",
  "смесь",
  "плиточный",
  "бетон",
  "кирпич",
  "профиль",
  "саморез",
  "шпатлевка",
  "шпаклевка",
  "армировка",
  "известь",
  "раствор",
  "сетка",
  "уголок",
  "грунт",
  "герметик",
];

const STOPWORDS_RU = [
  "привет",
  "здравствуйте",
  "есть",
  "в",
  "наличии",
  "наличие",
  "пожалуйста",
  "нужен",
  "нужно",
  "интересует",
  "подскажите",
  "уточните",
  "и",
  "или",
  "что",
  "сколько",
  "мне",
  "нам",
  "у",
  "на",
  "это",
  "этот",
  "эта",
  "эти",
  "по",
  "про",
  "для",
  "надо",
  "будет",
  "можно",
  "напиши",
  "покажи",
  "подробнее",
  "цена",
  "стоимость",
];

const STOPWORDS_KZ = [
  "салем",
  "сәлем",
  "бар",
  "барма",
  "қолда",
  "қолда бар",
  "керек",
  "өтінем",
  "айтыңыз",
  "қалай",
  "бағасы",
  "қанша",
  "саны",
  "туралы",
  "турасында",
  "маған",
  "бізге",
];

function norm(s: string): string {
  return (
    (s || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      // оставляем только буквы (латиница+кириллица), цифры и пробелы
      .replace(/[^0-9a-zA-Zа-яА-ЯёЁ\s]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function removeStopwords(q: string): string {
  const toks = q.split(" ").filter(Boolean);
  const sw = new Set([...STOPWORDS_RU, ...STOPWORDS_KZ]);
  return toks.filter((t) => !sw.has(t)).join(" ");
}

function extractProductSlice(raw: string): string {
  const s = norm(raw);
  // если в фразе есть товарное ключевое слово — берём "хвост" от него
  for (const kw of PRODUCT_KEYWORDS) {
    const i = s.indexOf(kw);
    if (i >= 0) {
      return removeStopwords(s.slice(i));
    }
  }
  // иначе просто чистим от стоп-слов
  return removeStopwords(s);
}

const SKU_RE = /\b([A-ZА-Я0-9]{2,}-[A-ZА-Я0-9]{2,}|\w{3,}-\d{1,})\b/i;

// Кол-во: считаем количеством ТОЛЬКО если в тексте есть маркеры расчёта
// или после числа стоит подходящая единица (шт/м/лист/упак/кг и т.п.)
// Важно: "мм" НЕ количество (это диаметр).
const QTY_MARKERS = [
  "нужно",
  "нужен",
  "посчитай",
  "сосчитай",
  "итог",
  "сумма",
  "к оплате",
  "закажи",
  "возьми",
  "количество",
  "qty",
];
const QTY_UNITS =
  /(шт|ш|pcs|дана|меш(?:ок|ка|ков)?|лист(?:ов|а)?|упак(?:ов|а)?|м(?!м)|метр(?:ов|а)?|kg|кг)\b/i;

function detectQty(raw: string): number | undefined {
  const s = norm(raw);
  const hasMarker = QTY_MARKERS.some((m) => s.includes(m));
  const m = s.match(/(\d{1,6})(?:[.,]\d+)?\s*([a-zA-Zа-яА-ЯёЁ]+)?/);
  if (!m) return undefined;
  const num = parseInt(m[1], 10);
  const unit = m[2] || "";
  if (hasMarker) return isNaN(num) ? undefined : num;
  if (unit && QTY_UNITS.test(unit)) return isNaN(num) ? undefined : num;
  if (/мм|mm/i.test(unit)) return undefined; // диаметр, не qty
  return undefined;
}

// Нормализация единиц
function parseQtyUnit(s: string) {
  const m = s.match(
    /(\d+(?:[.,]\d+)?)\s*(шт|штук|штуки|меш|мешок|мешка|мешков|м|метр(?:ов|а)?|лист(?:ов|а)?)/i,
  );
  if (!m)
    return {
      qty: undefined as number | undefined,
      unit: undefined as string | undefined,
    };
  const qty = Math.round(parseFloat(m[1].replace(",", ".")));
  const unitRaw = (m[2] || "").toLowerCase();
  const unit = /шт|штук|штуки/.test(unitRaw)
    ? "pcs"
    : /меш/.test(unitRaw)
      ? "bag"
      : /м|метр/.test(unitRaw)
        ? "m"
        : /лист/.test(unitRaw)
          ? "sheet"
          : undefined;
  return { qty, unit };
}

export function parseQuery(raw: string): any {
  const q = norm(raw);
  const t = q;

  // SKU
  const sku = (t.match(/[a-z]{2,5}-\d{2,3}/i) || [])[0]?.toUpperCase();

  // количество + единицы
  const { qty, unit } = parseQtyUnit(raw);

  // интенты корзины
  if (/корзин/.test(t) && /очист/.test(t)) return { intent: "clear_cart" };
  if (/корзин/.test(t) && /показ|покажи|что|смotr/i.test(t))
    return { intent: "show_cart" };
  if (/корзин/.test(t)) return { intent: "show_cart" };
  if (/оформ|заказ|счет|счёт|кп/.test(t))
    return { intent: "checkout", qty, unit, sku };

  if (/удали|убери|удалить/.test(t) && sku)
    return { intent: "remove_item", sku };

  if (/добав|в корзин|купи|полож|добавь/.test(t)) {
    // добавление в корзину: с SKU или по названию
    const nameQ = sku
      ? undefined
      : t.replace(/добав.*|в корзин.*|купи.*|полож.*/g, "").trim();
    return { intent: "add_to_cart", qty, unit, sku, query: nameQ };
  }

  // существующие интенты:
  if (/цена|price/.test(t) && sku) return { intent: "price", sku };
  if (/нужн|посчитай|сумм|итог|расчет|расчёт|сколько/.test(t) && (sku || t)) {
    return { intent: "calc", sku, qty, unit, query: t };
  }
  if (/есть|налич|найд|поиск|find|ищи|ищу/.test(t))
    return { intent: "availability", query: t };
  if (/найти|find/.test(t) || t.length >= 2)
    return { intent: "find", query: t };

  return { intent: "unknown" };
}
