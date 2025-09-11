// server/services/telegramBot.ts
// VisaConcierge UX: reply-меню; каталог/поиск/корзина из Google Sheets;
// оформление заказа с НДС; перезвон (телефон→день→время) с валидацией;
// NLU-хук; голос (опционально); гибкие обёртки к интеграциям.

import TelegramBot, {
  type Message,
  type InlineKeyboardButton,
} from "node-telegram-bot-api";

// === Интеграции/сервисы ===
import { parseQuery } from "./nlu";
import {
  searchProducts as searchProductsRaw,
  getPriceBySku as getPriceBySkuRaw,
  appendRow as appendRowRaw,
  getRows as getRowsRaw,
} from "../integrations/google/sheets";
import { cartService } from "./cart";
import { transcribeTelegramFile } from "./audioTranscription";
// ======================== CONFIG ========================
// ✅ используем секрет из окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
if (!BOT_TOKEN) console.warn("[telegramBot] TELEGRAM_BOT_TOKEN is empty");

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

const STORE_NAME = process.env.STORE_NAME || "Магазин";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "";

const PRICES_SHEET_ID = process.env.PRICES_SHEET_ID || "";
const PRICES_RANGE = process.env.PRICES_RANGE || "Catalog!A:Z";

const LEADS_SHEET_ID = process.env.LEADS_SHEET_ID || PRICES_SHEET_ID;
const LEADS_RANGE = process.env.LEADS_RANGE || "Leads!A:Z";

const CALLBACKS_SHEET_ID = process.env.CALLBACKS_SHEET_ID || PRICES_SHEET_ID;
const CALLBACKS_RANGE = process.env.CALLBACKS_RANGE || "Callbacks!A:Z";

const VAT_RATE = (Number(process.env.VAT_PERCENT ?? 12) || 12) / 100; // 12%
const PRICES_INCLUDE_VAT =
  String(process.env.PRICES_INCLUDE_VAT).toLowerCase() === "true";
const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || "KZT";
const fmtMoney = (n: number, currency = DEFAULT_CURRENCY) =>
  `${n.toFixed(2)} ${currency}`;

const DGIS_URL =
  "https://2gis.kz/astana/firm/70000001018060889?m=71.468778%2C51.163998%2F16";
//const ENABLE_VOICE_HANDLER =
//  (process.env.ENABLE_VOICE_HANDLER ?? "true") !== "false";
const CALLBACK_MIN_LEAD_MIN = Number(process.env.CALLBACK_MIN_LEAD_MIN ?? 10);
const AUTO_FREE_SEARCH = process.env.AUTO_FREE_SEARCH === "true";

const CATALOG_PAGE_SIZE = Number(process.env.CATALOG_PAGE_SIZE ?? 6);
// ======================== TYPES ========================
type SheetProduct = {
  sku: string;
  name: string;
  price: number;
  category?: string;
  currency?: string;
};

// ======================== STATE ========================
const lastSkuByChat = new Map<number, string>();
const lastProdByChat = new Map<number, SheetProduct>();

// master-каталог и текущее представление
const allCatalogByChat = new Map<number, SheetProduct[]>();
const viewCatalogByChat = new Map<number, SheetProduct[]>();
const catalogPageByChat = new Map<number, number>();
const categoriesByChat = new Map<number, string[]>();

// перезвон
const waitingPhone = new Set<number>();
const waitingDay = new Map<number, { phone: string }>();
const waitingTime = new Map<number, { phone: string; date: Date }>();
const lastPromptId = new Map<number, number>();

// меню-состояния
const waitingPrice = new Set<number>();
const waitingFind = new Set<number>();
const waitingPromo = new Set<number>();
const waitingCalc = new Map<number, { sku?: string }>();

function clearWaiting(chatId: number) {
  waitingPrice.delete(chatId);
  waitingFind.delete(chatId);
  waitingPromo.delete(chatId);
  waitingCalc.delete(chatId);
}

// ======================== FLEX WRAPPERS (Sheets) ========================
function toProduct(row: any): SheetProduct | null {
  const sku = row?.sku ?? row?.SKU ?? row?.Sku ?? row?.SkuCode ?? null;
  const name = row?.name ?? row?.Name ?? row?.TITLE ?? null;
  const priceRaw = row?.price ?? row?.Price ?? row?.COST ?? row?.cost;
  const currency =
    row?.currency ?? row?.Currency ?? row?.CURRENCY ?? DEFAULT_CURRENCY;
  const price = Number(priceRaw);
  if (!sku || !name || !isFinite(price)) return null;
  return {
    sku: String(sku).trim(),
    name: String(name).trim(),
    price,
    currency,
  };
}

async function searchProductsCompat(query: string): Promise<SheetProduct[]> {
  // sheets.ts: searchProducts(sheetId, range, query)
  const res = await (searchProductsRaw as any)(
    PRICES_SHEET_ID,
    PRICES_RANGE,
    query,
  );
  const arr: any[] = Array.isArray(res)
    ? res
    : (res?.items ?? res?.results ?? []);
  return arr.map(toProduct).filter((x): x is SheetProduct => !!x);
}

async function getPriceBySkuCompat(sku: string): Promise<number | null> {
  // sheets.ts: getPriceBySku(sheetId, range, sku)
  const res = await (getPriceBySkuRaw as any)(
    PRICES_SHEET_ID,
    PRICES_RANGE,
    String(sku).trim(),
  );
  const n = Number(res?.price ?? res?.Price ?? res);
  return isFinite(n) ? n : null;
}

async function listAllProductsFromSheet(): Promise<SheetProduct[]> {
  const rows: any[] = await (getRowsRaw as any)(PRICES_SHEET_ID, PRICES_RANGE);
  if (!rows || rows.length < 2) return [];
  const header = rows[0].map((x: any) => String(x).trim());
  const H = (name: string) =>
    header.findIndex((h: string) => h.toLowerCase() === name.toLowerCase());
  const idxSKU = H("SKU"),
    idxName = H("Name"),
    idxPrice = H("Price"),
    idxCur = H("Currency"),
    idxCat = H("Category");
  return rows
    .slice(1)
    .map((r: any[]) => ({
      sku: String(r[idxSKU] ?? "").trim(),
      name: String(r[idxName] ?? "").trim(),
      price: Number(r[idxPrice]),
      currency: String(r[idxCur] ?? DEFAULT_CURRENCY).trim(),
      category: String(r[idxCat] ?? "Прочее").trim(),
    }))
    .filter((p) => p.sku && p.name && isFinite(p.price));
}

async function appendRowCompat(
  kind: "orders" | "callbacks" | "promos" | "leads",
  row: any,
) {
  let id = LEADS_SHEET_ID,
    range = LEADS_RANGE;
  if (kind === "callbacks") {
    id = CALLBACKS_SHEET_ID;
    range = CALLBACKS_RANGE;
  }
  if (kind === "orders" || kind === "promos") {
    id = LEADS_SHEET_ID;
    range = LEADS_RANGE;
  }
  const asArray = Array.isArray(row) ? row : Object.values(row);
  try {
    await (appendRowRaw as any)(id, range, asArray);
    return;
  } catch {}
  try {
    await (appendRowRaw as any)(id, range, row);
    return;
  } catch {}
  try {
    await (appendRowRaw as any)(kind, row);
  } catch (e) {
    console.error("appendRow failed:", e);
  }
}

// ======================== UTILS ========================
function computeTotals(
  items: { Price: number; qty: number; Currency?: string }[],
) {
  const subtotal = items.reduce(
    (s, it) => s + (Number(it.Price) || 0) * it.qty,
    0,
  );
  const vat = PRICES_INCLUDE_VAT
    ? subtotal - subtotal / (1 + VAT_RATE)
    : subtotal * VAT_RATE;
  const total = PRICES_INCLUDE_VAT ? subtotal : subtotal + vat;
  const currency = items[0]?.Currency || DEFAULT_CURRENCY;
  return { subtotal, vat, total, currency };
}
function formatCartText(chatId: number): string {
  const items = cartService.items(chatId);
  if (!items.length) return "Корзина пуста.";
  const lines: string[] = [];
  for (const it of items) {
    const lineSum = it.Price * it.qty;
    lines.push(
      `• ${it.Name} — ${it.qty} × ${fmtMoney(it.Price, it.Currency)} = ${fmtMoney(lineSum, it.Currency)}`,
    );
  }
  const { subtotal, vat, total, currency } = computeTotals(items);
  lines.push(
    "",
    `Подытог (без НДС): ${fmtMoney(subtotal, currency)}`,
    `НДС ${Math.round(VAT_RATE * 100)}%: ${fmtMoney(vat, currency)}`,
    `Итого: ${fmtMoney(total, currency)}`,
  );
  return lines.join("\n");
}
function extractPhoneFromText(text?: string | null): string | null {
  if (!text) return null;
  const m = text.match(/\+?\d[\d\s()\-\–]{6,}\d/);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (digits.startsWith("8") && digits.length === 11)
    return "+7" + digits.slice(1);
  if (digits.startsWith("7") && digits.length === 11) return "+" + digits;
  if (digits.length === 10) return "+7" + digits;
  return "+" + digits;
}
function fmtDate(dt: Date) {
  const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
  return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function parseDateText(s: string): Date | null {
  const t = s.trim().toLowerCase();
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/сегодня/.test(t)) return base;
  if (/завтра/.test(t)) {
    base.setDate(base.getDate() + 1);
    return base;
  }
  const m = t.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/);
  if (m) {
    const d = parseInt(m[1], 10),
      mo = parseInt(m[2], 10) - 1;
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return new Date(y, mo, d);
  }
  return null;
}
function parseTimeText(s: string): { h: number; m: number } | null {
  const m = s.trim().match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10),
    mi = parseInt(m[2], 10);
  if (h >= 0 && h <= 23 && mi >= 0 && mi <= 59) return { h, m: mi };
  return null;
}
function ensureFutureDateTime(date: Date, h: number, m: number): Date | null {
  const dt = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    h,
    m,
    0,
    0,
  );
  const now = new Date().getTime();
  if (dt.getTime() <= now + CALLBACK_MIN_LEAD_MIN * 60 * 1000) return null;
  return dt;
}
function shouldAutoSearch(text: string) {
  if (!AUTO_FREE_SEARCH) return false;
  if (text.length < 3) return false;
  if (/\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}/.test(text)) return false;
  return /[a-zA-Zа-яА-Я]/.test(text);
}

// ======================== KEYBOARDS (VisaConcierge) ========================
const BTN_CATALOG = "🛍 Каталог";
const BTN_CART = "🛒 Корзина";
const BTN_CALLBACK = "📞 Перезвонить";
const BTN_HELP = "ℹ️ Помощь";
const BTN_2GIS = "📍 2ГИС";
const BTN_PRICE = "💰 Цена";
const BTN_FIND = "🔎 Поиск";
const BTN_CALC = "🧮 Расчёт";
const BTN_ORDER = "✅ Оформить заказ";
const BTN_PROMO = "🎟 Промокод";
const BTN_STOP = "⛔️ Стоп";

function mainMenuKb(): any {
  return {
    keyboard: [
      [{ text: BTN_CATALOG }, { text: BTN_CART }],
      [{ text: BTN_PRICE }, { text: BTN_FIND }],
      [{ text: BTN_CALC }, { text: BTN_ORDER }],
      [{ text: BTN_PROMO }, { text: BTN_CALLBACK }],
      [{ text: BTN_HELP }, { text: BTN_2GIS }],
      [{ text: BTN_STOP }],
    ],
    resize_keyboard: true,
    is_persistent: true as any,
  };
}
function productCardText(p: SheetProduct) {
  const price = fmtMoney(p.price, p.currency || DEFAULT_CURRENCY);
  // без SKU в тексте
  return `🧱 <b>${p.name}</b>\n💵 ${price}`;
}
function productCardKb(p: SheetProduct) {
  return {
    inline_keyboard: [
      [{ text: "➕ Добавить", callback_data: `add:${p.sku}` }],
      [{ text: "⬅️ Назад к категориям", callback_data: "nav:categories" }],
    ],
  };
}
function catalogHeaderKb() {
  return {
    inline_keyboard: [
      [{ text: "⬅️ Назад к категориям", callback_data: "nav:categories" }],
    ],
  };
}
function categoryKb(cats: string[]) {
  const rows: InlineKeyboardButton[][] = cats.map((c, idx) => [
    { text: c, callback_data: `cat:category#${idx}` },
  ]);
  rows.push([{ text: "⬅️ Назад", callback_data: "nav:home" }]);
  return { inline_keyboard: rows };
}
function dayKb(): { inline_keyboard: InlineKeyboardButton[][] } {
  return {
    inline_keyboard: [
      [{ text: "Сегодня", callback_data: "cb:day:today" }],
      [{ text: "Завтра", callback_data: "cb:day:tomorrow" }],
      [{ text: "Другая дата (текстом)", callback_data: "cb:day:text" }],
    ],
  };
}
function timeKb(): { inline_keyboard: InlineKeyboardButton[][] } {
  return {
    inline_keyboard: [
      [{ text: "10:00", callback_data: "cb:time:10:00" }],
      [{ text: "15:00", callback_data: "cb:time:15:00" }],
      [{ text: "19:00", callback_data: "cb:time:19:00" }],
      [{ text: "Другое время (текстом)", callback_data: "cb:time:text" }],
    ],
  };
}

// ======================== SCREENS ========================
async function showHome(chatId: number) {
  await bot.sendMessage(
    chatId,
    `Добро пожаловать в ${STORE_NAME}! Я помогу найти и посчитать материалы, оформить заказ или организовать перезвон.\n\nВыберите раздел ниже 👇`,
    { reply_markup: mainMenuKb() },
  );
}
async function showHelp(chatId: number) {
  await bot.sendMessage(
    chatId,
    "ℹ️ <b>Помощь</b>\n\n" +
      "• <b>Каталог</b> — листайте товары и добавляйте в корзину.\n" +
      "• <b>Поиск</b> — «🔎 Поиск», введите название.\n" +
      "• <b>Цена</b> — «💰 Цена», укажите товар.\n" +
      "• <b>Расчёт</b> — «🧮 Расчёт», бот спросит количество.\n" +
      "• <b>Корзина</b> — проверка позиций, оформление, очистка.\n" +
      "• <b>Перезвонить</b> — оставьте номер и удобное время.\n" +
      "• <b>Промокод</b> — примените код перед оформлением.\n\n" +
      "Локация: «📍 2ГИС».",
    { reply_markup: mainMenuKb(), parse_mode: "HTML" },
  );
}

// ======================== CATALOG (Sheets) ========================
async function renderCatalogPage(chatId: number, page = 0) {
  const items = viewCatalogByChat.get(chatId) || [];
  if (!items.length) {
    await bot.sendMessage(
      chatId,
      "Каталог пуст. Напишите название товара для поиска.",
      { reply_markup: mainMenuKb() },
    );
    return;
  }

  const pages = Math.max(1, Math.ceil(items.length / CATALOG_PAGE_SIZE));
  const cur = Math.max(0, Math.min(page, pages - 1));
  catalogPageByChat.set(chatId, cur);

  await bot.sendMessage(chatId, `🛍 Каталог • стр. ${cur + 1} / ${pages}`, {
    reply_markup: catalogHeaderKb(),
  });

  const slice = items.slice(
    cur * CATALOG_PAGE_SIZE,
    (cur + 1) * CATALOG_PAGE_SIZE,
  );
  for (const p of slice) {
    lastProdByChat.set(chatId, p);
    await bot.sendMessage(chatId, productCardText(p), {
      parse_mode: "HTML",
      reply_markup: productCardKb(p),
    });
  }

  if (pages > 1) {
    const row: any[] = [];
    if (cur > 0)
      row.push({ text: "« Пред.", callback_data: `cat:page:${cur - 1}` });
    if (cur < pages - 1)
      row.push({ text: "След. »", callback_data: `cat:page:${cur + 1}` });
    await bot.sendMessage(chatId, "Навигация по каталогу:", {
      reply_markup: { inline_keyboard: [row] },
    });
  }
}
async function showCategories(chatId: number) {
  const items = await listAllProductsFromSheet();
  if (!items.length) {
    await bot.sendMessage(chatId, "Каталог пуст. Попробуйте «🔎 Поиск».", {
      reply_markup: mainMenuKb(),
    });
    return;
  }
  const cats = Array.from(
    new Set(items.map((i) => (i.category || "Прочее").trim())),
  ).sort();
  categoriesByChat.set(chatId, cats);
  allCatalogByChat.set(chatId, items);
  viewCatalogByChat.set(chatId, items);
  await bot.sendMessage(chatId, "🗂 Выберите категорию:", {
    reply_markup: categoryKb(cats),
  });
}
async function showCatalog(chatId: number, category: string) {
  const all = allCatalogByChat.get(chatId) || [];
  const items = all.filter((p) => (p.category || "Прочее").trim() === category);
  if (!items.length) {
    await bot.sendMessage(chatId, "В этой категории пока пусто.", {
      reply_markup: mainMenuKb(),
    });
    return;
  }
  viewCatalogByChat.set(chatId, items);
  await renderCatalogPage(chatId, 0);
}

// ======================== CART / ORDER ========================
async function showCart(chatId: number) {
  const items = cartService.items(chatId);
  if (!items.length) {
    await bot.sendMessage(chatId, "Корзина пуста.", {
      reply_markup: mainMenuKb(),
    });
    return;
  }
  const txt = formatCartText(chatId);
  await bot.sendMessage(chatId, txt, { reply_markup: mainMenuKb() });
}
async function addToCart(chatId: number, sku: string, qty = 1) {
  const price = await getPriceBySkuCompat(sku.trim());
  if (price == null) {
    await bot.sendMessage(chatId, "Цена не найдена для SKU " + sku);
    return;
  }
  let name = sku;
  try {
    const res = await searchProductsCompat(sku);
    if (res[0]?.name) name = res[0].name;
  } catch {}
  cartService.add(
    chatId,
    { SKU: sku, Name: name, Price: price, Currency: DEFAULT_CURRENCY },
    qty,
  );
  lastSkuByChat.set(chatId, sku);

  const items = cartService.items(chatId);
  const positions = items.length;
  const totalQty = items.reduce((acc, it) => acc + it.qty, 0);
  const { subtotal } = computeTotals(items);

  await bot.sendMessage(
    chatId,
    `Добавил: ${name} × ${qty} = ${fmtMoney(price * qty)}\n` +
      `В корзине: ${positions} поз., ${totalQty} шт.\n` +
      `Итого (без НДС): ${fmtMoney(subtotal)}`,
    { reply_markup: mainMenuKb() },
  );
}
async function checkout(chatId: number) {
  const items = cartService.items(chatId);
  if (!items.length) {
    await bot.sendMessage(chatId, "Корзина пуста.", {
      reply_markup: mainMenuKb(),
    });
    return;
  }
  const { total, currency } = computeTotals(items);
  cartService.clear(chatId);
  await bot.sendMessage(
    chatId,
    `Заказ оформлен. К оплате: ${fmtMoney(total, currency)}. Менеджер свяжется с вами.`,
    { reply_markup: mainMenuKb() },
  );
  await appendRowCompat("orders", {
    chatId,
    total,
    currency,
    items: JSON.stringify(items),
    createdAt: new Date().toISOString(),
  });
}

// ======================== CALLBACK FLOW (Перезвон) ========================
async function startRequestCall(chatId: number, replyTo?: number) {
  clearWaiting(chatId);
  waitingPhone.add(chatId);
  const m = await bot.sendMessage(
    chatId,
    "Оставьте номер телефона. Можно нажать кнопку ниже 👇",
    {
      reply_to_message_id: replyTo,
      reply_markup: {
        keyboard: [
          [{ text: "📱 Поделиться номером", request_contact: true as any }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      } as any,
    },
  );
  lastPromptId.set(chatId, m.message_id);
}
// === TIMEZONE helpers (добавь один раз в файле, если их ещё нет) ===
const TIMEZONE = process.env.TIMEZONE || process.env.TZ || "Asia/Almaty";
const CALLBACKS_WRITE_EXTRA =
  (process.env.CALLBACKS_WRITE_EXTRA ?? "true") !== "false";

/** "09.09.2025 19:00" в заданном поясе (без библиотек) */
function formatLocal(dt: Date, tz = TIMEZONE) {
  const f = new Intl.DateTimeFormat("ru-RU", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  // "09.09.2025, 19:00" -> "09.09.2025 19:00"
  return f.format(dt).replace(",", "");
}

/** Серийное число Google Sheets (UTC) — удобно форматировать в таблице как Date/Time */
function toSheetsSerialUTC(dt: Date) {
  return dt.getTime() / 86400000 + 25569; // дни с 1899-12-30
}

// === MAIN: запись заявки на перезвон ===
async function notifyAdminCallback(
  chatId: number,
  phone: string,
  timeLabel?: string,
  timeISO?: string,
) {
  if (!ADMIN_CHAT_ID) return;

  // (A..G — это комментарии для наглядности; в коде остаются как JS-комментарии)
  // A: CallbackID
  // B: Channel
  // C: From
  // D: Phone
  // E: Type
  // F: CreatedAt (UTC ISO)
  // G: PreferredTime (UTC ISO)

  const user = await bot.getChat(chatId);
  const u = user as any;
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
  const handle = u.username ? `@${u.username}` : "—";
  const fromField = handle !== "—" ? handle : name;

  const cartText = formatCartText(chatId);

  // TG-уведомление админу — без изменений
  const payload =
    `📞 Заявка на звонок\n` +
    `Магазин: ${STORE_NAME}\n` +
    `Пользователь: ${name} ${handle}\n` +
    `chatId: ${chatId}\n` +
    `Телефон: ${phone}\n` +
    `Время: ${timeLabel || "не указано"}${timeISO ? ` (${timeISO})` : ""}\n\n` +
    `Корзина:\n${cartText}`;
  await bot.sendMessage(Number(ADMIN_CHAT_ID), payload);

  // Запись в Google Sheets — фиксированный порядок колонок
  try {
    const callbackId = `cb_${Date.now()}`;
    const createdAt = new Date();
    const preferred = timeISO ? new Date(timeISO) : null;

    // Основные колонки A..G
    const rowAtoG = [
      callbackId, // A CallbackID
      "tg", // B Channel
      fromField, // C From
      phone, // D Phone
      "CALLBACK", // E Type
      createdAt.toISOString(), // F CreatedAt (UTC ISO)
      preferred ? preferred.toISOString() : "", // G PreferredTime (UTC ISO)
    ];

    // Доп. колонки H..K (по желанию): локальная строка + serial (UTC)
    const extraHK = [
      formatLocal(createdAt), // H CreatedAtLocal (Asia/Almaty)
      preferred ? formatLocal(preferred) : "", // I PreferredTimeLocal
      toSheetsSerialUTC(createdAt), // J CreatedAtSerial (UTC)
      preferred ? toSheetsSerialUTC(preferred) : "", // K PreferredTimeSerial (UTC)
    ];

    const values = CALLBACKS_WRITE_EXTRA ? [...rowAtoG, ...extraHK] : rowAtoG;

    // Пишем МАССИВ по заданному диапазону
    await (appendRowRaw as any)(CALLBACKS_SHEET_ID, CALLBACKS_RANGE, values);
  } catch (e) {
    console.error("append callback row failed:", e);
  }
}

// ======================== BOT: /start ========================
bot.onText(/^\/start$/, async (msg) => showHome(msg.chat.id));

// ======================== BOT: message ========================
bot.on("message", async (msg: Message) => {
  const chatId = msg.chat.id;

  // контакт (перезвон)
  if (msg.contact && waitingPhone.has(chatId)) {
    const phone = msg.contact.phone_number;
    waitingPhone.delete(chatId);
    waitingDay.set(chatId, { phone });
    const m = await bot.sendMessage(chatId, "Когда удобно? Выберите день:", {
      reply_markup: dayKb(),
    });
    lastPromptId.set(chatId, m.message_id);
    return;
  }

  const text = (msg.text || "").trim();
  if (!text) return;

  // приоритет — шаги перезвона
  if (waitingPhone.has(chatId)) {
    const phone = extractPhoneFromText(text);
    if (phone) {
      waitingPhone.delete(chatId);
      waitingDay.set(chatId, { phone });
      const m = await bot.sendMessage(chatId, "Когда удобно? Выберите день:", {
        reply_markup: dayKb(),
      });
      lastPromptId.set(chatId, m.message_id);
    } else {
      const m = await bot.sendMessage(
        chatId,
        "Похоже, это не номер. Отправьте номер или нажмите «📱 Поделиться номером».",
        {},
      );
      lastPromptId.set(chatId, m.message_id);
    }
    return;
  }
  if (waitingDay.has(chatId)) {
    const rec = waitingDay.get(chatId)!;
    const d = parseDateText(text.toLowerCase());
    if (!d) {
      const m = await bot.sendMessage(
        chatId,
        "Не понял дату. Напишите «сегодня», «завтра» или ДД.ММ.ГГГГ.",
      );
      lastPromptId.set(chatId, m.message_id);
      return;
    }
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = new Date();
    const today0 = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    if (date.getTime() < today0.getTime()) {
      const m2 = await bot.sendMessage(
        chatId,
        "Дата уже в прошлом. Укажите «сегодня», «завтра» или будущую дату.",
      );
      lastPromptId.set(chatId, m2.message_id);
      return;
    }
    waitingDay.delete(chatId);
    waitingTime.set(chatId, { phone: rec.phone, date });
    const m = await bot.sendMessage(chatId, "Укажите время:", {
      reply_markup: timeKb(),
    });
    lastPromptId.set(chatId, m.message_id);
    return;
  }
  if (waitingTime.has(chatId)) {
    const rec = waitingTime.get(chatId)!;
    const tm = parseTimeText(text);
    if (!tm) {
      const m = await bot.sendMessage(
        chatId,
        "Не понял время. Укажите в формате ЧЧ:ММ, например 17:00.",
      );
      lastPromptId.set(chatId, m.message_id);
      return;
    }
    const dt = ensureFutureDateTime(rec.date, tm.h, tm.m);
    if (!dt) {
      const m = await bot.sendMessage(
        chatId,
        `Это время уже недоступно. Укажите время минимум через ${CALLBACK_MIN_LEAD_MIN} мин.`,
        { reply_markup: timeKb() },
      );
      lastPromptId.set(chatId, m.message_id);
      return;
    }
    waitingTime.delete(chatId);
    await bot.sendMessage(
      chatId,
      `Спасибо! Менеджер свяжется с вами ${fmtDate(dt)}.`,
      { reply_markup: { remove_keyboard: true } as any },
    );
    await notifyAdminCallback(chatId, rec.phone, fmtDate(dt), dt.toISOString());
    return;
  }

  // главное меню
  if (text === BTN_CATALOG) return showCategories(chatId);
  if (text === BTN_CART) return showCart(chatId);
  if (text === BTN_HELP) return showHelp(chatId);
  if (text === BTN_2GIS)
    return bot.sendMessage(chatId, `📍 ${DGIS_URL}`, {
      reply_markup: mainMenuKb(),
    });
  if (text === BTN_CALLBACK)
    return startRequestCall(chatId, lastPromptId.get(chatId));
  if (text === BTN_ORDER) return checkout(chatId);

  if (text === BTN_PRICE) {
    clearWaiting(chatId);
    waitingPrice.add(chatId);
    await bot.sendMessage(chatId, "Укажите товар для проверки цены:");
    return;
  }
  if (waitingPrice.has(chatId)) {
    waitingPrice.delete(chatId);
    const res = await searchProductsCompat(text);
    if (!res.length)
      return bot.sendMessage(chatId, "Ничего не найдено.", {
        reply_markup: mainMenuKb(),
      });
    const p = res[0];
    lastSkuByChat.set(chatId, p.sku);
    lastProdByChat.set(chatId, p);
    await bot.sendMessage(
      chatId,
      `${p.name}\nЦена: ${fmtMoney(p.price, p.currency || DEFAULT_CURRENCY)}`,
      { reply_markup: mainMenuKb() },
    );
    return;
  }

  if (text === BTN_FIND) {
    clearWaiting(chatId);
    waitingFind.add(chatId);
    await bot.sendMessage(chatId, "Что ищем? Напишите название товара:");
    return;
  }
  if (waitingFind.has(chatId)) {
    waitingFind.delete(chatId);
    const results = await searchProductsCompat(text);
    if (!results.length) {
      await bot.sendMessage(chatId, "Ничего не найдено. Попробуйте иначе.", {
        reply_markup: mainMenuKb(),
      });
      return;
    }
    viewCatalogByChat.set(chatId, results);
    await bot.sendMessage(
      chatId,
      `🔎 Найдено: ${results.length}. Показаны первые ${Math.min(results.length, 6)}.`,
      { reply_markup: catalogHeaderKb() },
    );
    await renderCatalogPage(chatId, 0);
    return;
  }

  if (text === BTN_CALC) {
    clearWaiting(chatId);
    const last = lastProdByChat.get(chatId);
    if (!last) {
      waitingCalc.set(chatId, {});
      await bot.sendMessage(
        chatId,
        "Какой товар посчитать? Напишите название:",
      );
    } else {
      waitingCalc.set(chatId, { sku: last.sku });
      await bot.sendMessage(
        chatId,
        `Сколько штук «${last.name}» посчитать? Укажите число:`,
      );
    }
    return;
  }
  if (waitingCalc.has(chatId)) {
    const st = waitingCalc.get(chatId)!;
    if (!st.sku) {
      const found = await searchProductsCompat(text);
      if (!found.length)
        return bot.sendMessage(
          chatId,
          "Не нашёл такой товар. Попробуйте ещё раз.",
          { reply_markup: mainMenuKb() },
        );
      const p = found[0];
      lastProdByChat.set(chatId, p);
      lastSkuByChat.set(chatId, p.sku);
      waitingCalc.set(chatId, { sku: p.sku });
      await bot.sendMessage(
        chatId,
        `Сколько штук «${p.name}» посчитать? Укажите число:`,
      );
      return;
    } else {
      const qty = parseInt(text, 10);
      if (!isFinite(qty) || qty <= 0) {
        await bot.sendMessage(chatId, "Введите целое положительное число.");
        return;
      }
      const price = await getPriceBySkuCompat(st.sku);
      waitingCalc.delete(chatId);
      if (price == null)
        return bot.sendMessage(chatId, "Цена не найдена.", {
          reply_markup: mainMenuKb(),
        });
      await bot.sendMessage(
        chatId,
        `${qty} × ${fmtMoney(price)} = ${fmtMoney(qty * price)}`,
        { reply_markup: mainMenuKb() },
      );
      return;
    }
  }

  if (text === BTN_PROMO) {
    clearWaiting(chatId);
    waitingPromo.add(chatId);
    await bot.sendMessage(chatId, "Введите промокод:");
    return;
  }
  if (waitingPromo.has(chatId)) {
    waitingPromo.delete(chatId);
    const code = text.trim();
    await appendRowCompat("promos", {
      chatId,
      code,
      createdAt: new Date().toISOString(),
    });
    await bot.sendMessage(chatId, `Промокод «${code}» принят.`, {
      reply_markup: mainMenuKb(),
    });
    return;
  }

  if (text === BTN_STOP) {
    await bot.sendMessage(
      chatId,
      "Клавиатура скрыта. Чтобы вернуться — отправьте /start.",
      { reply_markup: { remove_keyboard: true } as any },
    );
    return;
  }

  // Быстрые фразы
  const low = text.toLowerCase();
  if (/корзина|покажи корзину/.test(low)) return showCart(chatId);
  if (/оформить заказ|оформляй|заказ оформ/.test(low)) return checkout(chatId);
  if (/очистить корзину|очисти корзину|сброс корзины/.test(low)) {
    cartService.clear(chatId);
    await bot.sendMessage(chatId, "Корзина очищена.", {
      reply_markup: mainMenuKb(),
    });
    return;
  }
  if (/перезвон|перезвонить|позвоните/.test(low))
    return startRequestCall(chatId, lastPromptId.get(chatId));

  // NLU
  const intent = parseQuery(text);
  if (intent?.intent === "search") {
    const q = intent.query || text;
    const results = await searchProductsCompat(q);
    if (!results.length) return bot.sendMessage(chatId, "Ничего не найдено.");
    if (intent.qty && results[0]) {
      const p = results[0];
      lastSkuByChat.set(chatId, p.sku);
      lastProdByChat.set(chatId, p);
      await bot.sendMessage(
        chatId,
        `${p.name}\n${intent.qty} × ${fmtMoney(p.price, p.currency || DEFAULT_CURRENCY)} = ${fmtMoney(p.price * intent.qty, p.currency || DEFAULT_CURRENCY)}`,
        { reply_markup: productCardKb(p) },
      );
      return;
    }
    if (results.length === 1) {
      const p = results[0];
      lastSkuByChat.set(chatId, p.sku);
      lastProdByChat.set(chatId, p);
      await bot.sendMessage(chatId, productCardText(p), {
        parse_mode: "HTML",
        reply_markup: productCardKb(p),
      });
      return;
    }
    await bot.sendMessage(
      chatId,
      `Найдено: ${results.length}\nВыберите товар:`,
    );
    for (const p of results.slice(0, 12)) {
      await bot.sendMessage(chatId, productCardText(p), {
        parse_mode: "HTML",
        reply_markup: productCardKb(p),
      });
    }
    return;
  }

  // Автопоиск — только если явно включён через ENV
  if (!shouldAutoSearch(text)) return;
  const results = await searchProductsCompat(text);
  if (!results.length) return bot.sendMessage(chatId, "Ничего не найдено.");
  if (results.length === 1) {
    const p = results[0];
    lastSkuByChat.set(chatId, p.sku);
    lastProdByChat.set(chatId, p);
    await bot.sendMessage(chatId, productCardText(p), {
      parse_mode: "HTML",
      reply_markup: productCardKb(p),
    });
    return;
  }
  await bot.sendMessage(chatId, `Найдено: ${results.length}\nВыберите товар:`);
  for (const p of results.slice(0, 12)) {
    await bot.sendMessage(chatId, productCardText(p), {
      parse_mode: "HTML",
      reply_markup: productCardKb(p),
    });
  }
});

// ======================== BOT: voice ========================
// --- AUDIO FILES (regular audio) ---
bot.on("audio", async (msg) => {
  const chatId = msg.chat.id;
  try {
    const fileId = msg.audio?.file_id;
    if (!fileId) return;
    await bot.sendChatAction(chatId, "typing");
    const text = await transcribeTelegramFile(fileId, BOT_TOKEN);
    if (!text) {
      await bot.sendMessage(
        chatId,
        "Не удалось распознать аудио. Повторите, пожалуйста.",
      );
      return;
    }
    await handleRecognizedTextMessage(bot, chatId, text);
  } catch {
    await bot.sendMessage(chatId, "Ошибка обработки аудио.");
  }
});

// --- AUDIO DOCUMENTS (documents with audio/* mime) ---
bot.on("document", async (msg) => {
  const chatId = msg.chat.id;
  const doc = msg.document;
  if (!doc?.mime_type?.startsWith("audio/")) return; // пропускаем не-аудио
  try {
    await bot.sendChatAction(chatId, "typing");
    const text = await transcribeTelegramFile(doc.file_id, BOT_TOKEN);
    if (!text) {
      await bot.sendMessage(
        chatId,
        "Не удалось распознать аудио-документ. Повторите, пожалуйста.",
      );
      return;
    }
    await handleRecognizedTextMessage(bot, chatId, text);
  } catch {
    await bot.sendMessage(chatId, "Ошибка обработки аудио-документа.");
  }
});

// Унифицированная реакция на распознанный текст
async function handleRecognizedText(chatId: number, text: string) {
  const intent = parseQuery(text);
  if (intent?.intent === "search") {
    const results = await searchProductsCompat(intent.query || text);
    if (!results.length) {
      await bot.sendMessage(chatId, "Ничего не найдено.");
      return;
    }
    // если указано количество — сразу добавить/собрать в корзину
    if (intent.qty && results[0]) {
      const p = results[0];
      await bot.sendMessage(chatId, productCardText(p), {
        parse_mode: "HTML",
        reply_markup: productCardKb(p),
      });
      return;
    }
    for (const p of results.slice(0, 6)) {
      await bot.sendMessage(chatId, productCardText(p), {
        parse_mode: "HTML",
        reply_markup: productCardKb(p),
      });
    }
    return;
  }
  // fallback: просто поиск по каталогу
  const results = await searchProductsCompat(text);
  if (!results.length) {
    await bot.sendMessage(chatId, "Ничего не найдено.");
    return;
  }
  for (const p of results.slice(0, 6)) {
    await bot.sendMessage(chatId, productCardText(p), {
      parse_mode: "HTML",
      reply_markup: productCardKb(p),
    });
  }
}

// ======================== CALLBACKS ========================
bot.on("callback_query", async (q) => {
  const chatId = q.message?.chat.id!;
  const data = q.data!;
  try {
    if (data === "nav:home") {
      await bot.answerCallbackQuery(q.id);
      await showHome(chatId);
      return;
    }
    if (data === "nav:categories") {
      await bot.answerCallbackQuery(q.id);
      await showCategories(chatId);
      return;
    }

    if (data.startsWith("add:")) {
      await addToCart(chatId, data.split(":")[1], 1);
      await bot.answerCallbackQuery(q.id, { text: "Добавлено" });
      return;
    }
    if (data.startsWith("cat:page:")) {
      const page = parseInt(data.split(":")[2], 10) || 0;
      await renderCatalogPage(chatId, page);
      await bot.answerCallbackQuery(q.id);
      return;
    }
    if (data.startsWith("cat:category#")) {
      const idx = parseInt(data.split("#")[1], 10);
      const cats = categoriesByChat.get(chatId) || [];
      const cat = cats[idx];
      if (cat) await showCatalog(chatId, cat);
      else
        await bot.sendMessage(
          chatId,
          "Категория не найдена. Откройте «Каталог» заново.",
        );
      await bot.answerCallbackQuery(q.id);
      return;
    }

    // Перезвон — день
    if (data.startsWith("cb:day:")) {
      await bot.answerCallbackQuery(q.id);
      if (!waitingDay.has(chatId)) return;
      const rec = waitingDay.get(chatId)!;
      let date: Date | null = null;
      if (data === "cb:day:today") date = new Date();
      if (data === "cb:day:tomorrow") {
        date = new Date();
        date.setDate(date.getDate() + 1);
      }
      if (date) {
        date = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        waitingDay.delete(chatId);
        waitingTime.set(chatId, { phone: rec.phone, date });
        const m = await bot.sendMessage(chatId, "Укажите время:", {
          reply_markup: timeKb(),
        });
        lastPromptId.set(chatId, m.message_id);
      } else if (data === "cb:day:text") {
        const m = await bot.sendMessage(
          chatId,
          "Напишите дату в формате ДД.ММ.ГГГГ (например, 09.09.2025) или «сегодня/завтра».",
          {},
        );
        lastPromptId.set(chatId, m.message_id);
      }
      return;
    }

    // Перезвон — время
    if (data.startsWith("cb:time:")) {
      await bot.answerCallbackQuery(q.id);
      const rec = waitingTime.get(chatId);
      if (!rec) return;

      if (data === "cb:time:text") {
        const m = await bot.sendMessage(
          chatId,
          "Напишите время в формате ЧЧ:ММ (например, 17:00).",
          {},
        );
        lastPromptId.set(chatId, m.message_id);
        return;
      }

      const [, , hh, mm] = data.split(":"); // cb:time:HH:MM
      const dt = ensureFutureDateTime(
        rec.date,
        parseInt(hh, 10),
        parseInt(mm, 10),
      );
      if (!dt) {
        const m = await bot.sendMessage(
          chatId,
          `Это время уже недоступно. Укажите время минимум через ${CALLBACK_MIN_LEAD_MIN} мин.`,
          { reply_markup: timeKb() },
        );
        lastPromptId.set(chatId, m.message_id);
        return;
      }

      waitingTime.delete(chatId);
      await bot.sendMessage(
        chatId,
        `Спасибо! Менеджер свяжется с вами ${fmtDate(dt)}.`,
        { reply_markup: { remove_keyboard: true } as any },
      );
      await notifyAdminCallback(
        chatId,
        rec.phone,
        fmtDate(dt),
        dt.toISOString(),
      );
      return;
    }
  } catch (e) {
    console.error("callback error:", e);
    try {
      await bot.answerCallbackQuery(q.id, { text: "Ошибка" });
    } catch {}
  }
});

// ======================== SERVICE (для routes.ts) ========================
let __started = false;

async function initialize() {
  if (!__started) {
    await bot.startPolling();
    __started = true;
  }
}

async function start() { return initialize(); }

async function stop() {
  if (__started) {
    await bot.stopPolling();
    __started = false;
  }
}

// Единая реакция на распознанный текст (вне initialize)
const handleRecognizedTextMessage = async (
  bot: any,
  chatId: number,
  text: string,
) => {
  const intent = parseQuery(text);

  if (intent?.intent === "search") {
    const results = await searchProductsCompat(intent.query || text);
    if (!results.length) {
      await bot.sendMessage(chatId, "Ничего не найдено.");
      return;
    }
    for (const p of results.slice(0, 6)) {
      await bot.sendMessage(chatId, productCardText(p), {
        parse_mode: "HTML",
        reply_markup: productCardKb(p),
      });
    }
    return;
  }

  // fallback: обычный поиск
  const results = await searchProductsCompat(text);
  if (!results.length) {
    await bot.sendMessage(chatId, "Ничего не найдено.");
    return;
  }
  for (const p of results.slice(0, 6)) {
    await bot.sendMessage(chatId, productCardText(p), {
      parse_mode: "HTML",
      reply_markup: productCardKb(p),
    });
  }
};
export const telegramBotService = {
  initialize,
  start,
  stop,
  getBot: () => bot,
};

export default telegramBotService;