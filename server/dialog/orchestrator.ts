import { parseUtterance } from "../nlu/intents";
import { funnelService } from "../services/funnel";

export async function handleDialog(ctx: {msg: any, customerId: number, tenantId: number}) {
  // FSM + воронка 3 слотов: purpose/volume/budget → deadline/conditions
  // если слот пуст — задаём уточняющий вопрос
  // по intents вызываем Catalog/Cart/Leads/Docs сервисы
  // возвращаем { text: string, tts?: Buffer, attachments?: Array<{type:"image"|"file", url:string}> }
  
  const { msg, customerId, tenantId } = ctx;
  const text = msg.text || "";
  const lang = msg.lang || "ru";
  
  // Parse user intent and entities
  const parsed = parseUtterance(text, lang);
  
  // Funnel session will be managed by FunnelService when needed
  
  // Handle different intents
  switch (parsed.intent) {
    case "search":
      return await handleSearch(parsed, lang, tenantId);
    
    case "add_to_cart":
      return await handleAddToCart(parsed, customerId, tenantId, lang);
    
    case "show_cart":
      return await handleShowCart(customerId, tenantId, lang);
    
    case "checkout":
      return await handleCheckout(customerId, tenantId, lang);
    
    case "quote":
      return await handleQuote(customerId, tenantId, lang);
    
    case "invoice":
      return await handleInvoice(customerId, tenantId, lang);
    
    case "help":
      return await handleHelp(lang);
    
    case "stop":
      return await handleStop(customerId, tenantId, lang);
    
    default:
      // If intent is unknown, check funnel state and ask next question
      return await handleFunnel(text, customerId, tenantId, lang);
  }
}

// Generate customer chat ID for funnel service
function getCustomerChatId(customerId: number, tenantId: number): string {
  return `${tenantId}_${customerId}`;
}

async function handleFunnel(text: string, customerId: number, tenantId: number, lang: "ru"|"kk") {
  const chatId = getCustomerChatId(customerId, tenantId);
  const funnelLang = (lang === "kk" || lang === "kz") ? "kz" : "ru"; // Convert to funnel service lang format
  
  // Check if funnel session exists
  if (!funnelService.has(chatId)) {
    // Start new funnel session
    const startPrompt = funnelService.start(chatId, funnelLang);
    return { text: startPrompt };
  } else {
    // Continue existing funnel session
    const nextPrompt = funnelService.next(chatId, text);
    return { text: nextPrompt };
  }
}

async function handleSearch(parsed: any, lang: "ru"|"kk", tenantId: number) {
  // TODO: Implement catalog search
  const responseText = lang === 'kk' ? 
    "Іздеу нәтижелері дайындалуда..." : 
    "Результаты поиска готовятся...";
  
  return { text: responseText };
}

async function handleAddToCart(parsed: any, customerId: number, tenantId: number, lang: "ru"|"kk") {
  // TODO: Implement add to cart logic
  const responseText = lang === 'kk' ? 
    "Тауар себетке қосылды" : 
    "Товар добавлен в корзину";
  
  return { text: responseText };
}

async function handleShowCart(customerId: number, tenantId: number, lang: "ru"|"kk") {
  // TODO: Implement show cart logic
  const responseText = lang === 'kk' ? 
    "Сіздің себеттегі тауарлар:" : 
    "Товары в вашей корзине:";
  
  return { text: responseText };
}

async function handleCheckout(customerId: number, tenantId: number, lang: "ru"|"kk") {
  // TODO: Implement checkout logic
  const responseText = lang === 'kk' ? 
    "Тапсырысты рәсімдеу..." : 
    "Оформление заказа...";
  
  return { text: responseText };
}

async function handleQuote(customerId: number, tenantId: number, lang: "ru"|"kk") {
  // TODO: Implement quote generation
  const responseText = lang === 'kk' ? 
    "Коммерциялық ұсыныс дайындалуда..." : 
    "Коммерческое предложение готовится...";
  
  return { text: responseText };
}

async function handleInvoice(customerId: number, tenantId: number, lang: "ru"|"kk") {
  // TODO: Implement invoice generation
  const responseText = lang === 'kk' ? 
    "Шот дайындалуда..." : 
    "Счет готовится...";
  
  return { text: responseText };
}

async function handleHelp(lang: "ru"|"kk") {
  const helpText = lang === 'kk' ? 
    "Мен сізге тауарларды табуға, тапсырыс беруге және сұрақтарға жауап беруге көмектесе аламын." :
    "Я могу помочь вам найти товары, оформить заказ и ответить на вопросы.";
  
  return { text: helpText };
}

async function handleStop(customerId: number, tenantId: number, lang: "ru"|"kk") {
  // Cancel active funnel session if exists
  const chatId = getCustomerChatId(customerId, tenantId);
  funnelService.cancel(chatId);
  
  const stopText = lang === 'kk' ? 
    "Жақсы, диалогты тоқтатамын. Қайта хабарласу үшін кез келген уақытта жаза аласыз." :
    "Хорошо, останавливаю диалог. Вы можете написать в любое время для возобновления общения.";
  
  return { text: stopText };
}