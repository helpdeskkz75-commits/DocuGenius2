export type Parsed = { 
  intent: string; 
  entities: Record<string, any>; 
};

export function parseUtterance(input: string, lang: "ru"|"kk"): Parsed {
  // правила для: search, add_to_cart, show_cart, remove/clear, checkout, quote, invoice, delivery/info, promo, address, callback, help, stop, unknown
  // распознать qty/sku/name простыми регекспами и словарями единиц
  
  const text = input.toLowerCase().trim();
  
  // Patterns for Russian
  const ruPatterns = {
    search: /(найд|ищ|поиск|покаж|есть ли|нужн)/i,
    add_to_cart: /(добав|взять|хочу|куп|заказ|положи)/i,
    show_cart: /(корзин|что у меня|мой заказ|что заказал)/i,
    remove: /(убер|удал|не нужн|отмен)/i,
    clear: /(очист|всё убер|новый заказ)/i,
    checkout: /(оформ|заказ|купить|офор|готов)/i,
    quote: /(коммерч|кп|предлож|расчет|смет)/i,
    invoice: /(счет|инвойс|выстав)/i,
    delivery: /(доставк|привез|когда|где)/i,
    address: /(адрес|куда|место)/i,
    callback: /(перезвон|звонок|связат|тел)/i,
    help: /(помощь|как|что|справк)/i,
    stop: /(стоп|хватит|отстань|больше не)/i,
  };
  
  // Patterns for Kazakh
  const kkPatterns = {
    search: /(тап|іздеу|көрсет|бар ма)/i,
    add_to_cart: /(қос|алу|қалайм|сатып ал)/i,
    show_cart: /(себет|менің|тапсырыс)/i,
    // ... можно расширить казахские паттерны
  };
  
  const patterns = lang === 'kk' ? kkPatterns : ruPatterns;
  
  // Check for specific intents
  for (const [intent, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      const entities = extractEntities(text, intent, lang);
      return { intent, entities };
    }
  }
  
  // Default to search if contains product-like terms
  if (/\b(товар|продукт|шт|кг|литр|метр)\b/i.test(text)) {
    return {
      intent: "search",
      entities: extractEntities(text, "search", lang)
    };
  }
  
  return { intent: "unknown", entities: {} };
}

function extractEntities(text: string, intent: string, lang: "ru"|"kk"): Record<string, any> {
  const entities: Record<string, any> = {};
  
  // Extract quantity
  const qtyMatch = text.match(/(\d+)\s*(шт|штук|кг|литр|метр|пак|упак|коробк)/i);
  if (qtyMatch) {
    entities.qty = parseInt(qtyMatch[1]);
    entities.unit = qtyMatch[2];
  }
  
  // Extract SKU (alphanumeric codes)
  const skuMatch = text.match(/\b([A-Z0-9]{3,})\b/i);
  if (skuMatch) {
    entities.sku = skuMatch[1];
  }
  
  // Extract product name (words between quantity and unit, or main nouns)
  const nameMatch = text.match(/(?:найди|ищу|нужен|нужна|хочу)\s+(.+?)(?:\s+\d+\s*шт|$)/i);
  if (nameMatch) {
    entities.name = nameMatch[1].trim();
  }
  
  // Extract price range
  const priceMatch = text.match(/(?:до|максимум|не более)\s+(\d+)/i);
  if (priceMatch) {
    entities.maxPrice = parseInt(priceMatch[1]);
  }
  
  return entities;
}