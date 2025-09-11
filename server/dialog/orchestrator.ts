import { parseUtterance } from "../nlu/intents";

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
  
  // Get or create funnel session for this customer
  const funnelState = await getFunnelState(customerId, tenantId);
  
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
      return await handleStop(customerId, lang);
    
    default:
      // If intent is unknown, check funnel state and ask next question
      return await handleFunnel(text, funnelState, customerId, tenantId, lang);
  }
}

// Funnel state management
interface FunnelState {
  purpose?: string;
  volume?: string;
  budget?: string;
  step: 'purpose' | 'volume' | 'budget' | 'complete';
}

async function getFunnelState(customerId: number, tenantId: number): Promise<FunnelState> {
  // TODO: Get from database or memory store
  // For now, return initial state
  return { step: 'purpose' };
}

async function updateFunnelState(customerId: number, tenantId: number, state: FunnelState): Promise<void> {
  // TODO: Save to database or memory store
}

async function handleFunnel(text: string, state: FunnelState, customerId: number, tenantId: number, lang: "ru"|"kk") {
  const responses = {
    ru: {
      purpose: "Для каких целей вам нужны товары? (например: для офиса, производства, личного использования)",
      volume: "Какой объем или бюджет вас интересует?",
      budget: "Какие сроки поставки и условия оплаты предпочитаете?",
      complete: "Спасибо за информацию! Теперь я могу предложить вам подходящие товары."
    },
    kk: {
      purpose: "Тауарлар қандай мақсатта керек? (мысалы: кеңсе үшін, өндіріс үшін, жеке пайдалану үшін)",
      volume: "Қандай көлем немесе бюджет қызықтырады?",
      budget: "Қандай жеткізу мерзімі мен төлем шарттарын қалайсыз?",
      complete: "Ақпарат үшін рахмет! Енді сізге қолайлы тауарларды ұсына аламын."
    }
  };
  
  const langResponses = responses[lang] || responses.ru;
  
  // Update state based on current step
  const newState = { ...state };
  
  switch (state.step) {
    case 'purpose':
      newState.purpose = text;
      newState.step = 'volume';
      await updateFunnelState(customerId, tenantId, newState);
      return { text: langResponses.volume };
    
    case 'volume':
      newState.volume = text;
      newState.step = 'budget';
      await updateFunnelState(customerId, tenantId, newState);
      return { text: langResponses.budget };
    
    case 'budget':
      newState.budget = text;
      newState.step = 'complete';
      await updateFunnelState(customerId, tenantId, newState);
      return { text: langResponses.complete };
    
    default:
      return { text: langResponses.purpose };
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

async function handleStop(customerId: number, lang: "ru"|"kk") {
  const stopText = lang === 'kk' ? 
    "Жақсы, диалогты тоқтатамын. Қайта хабарласу үшін кез келген уақытта жаза аласыз." :
    "Хорошо, останавливаю диалог. Вы можете написать в любое время для возобновления общения.";
  
  return { text: stopText };
}