import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';
import { getPriceBySku, searchProducts, appendRow } from '../integrations/google/sheets';
import { generateQrPngBuffer } from '../services/qr';
import { funnelService } from '../services/funnel';
import { detectLang } from '../services/langDetect';

class TelegramBotService {
  private bot: TelegramBot | null = null;
  private isInitialized = false;

  async initialize() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.log('TELEGRAM_BOT_TOKEN not set, skipping Telegram bot initialization');
      return;
    }

    this.bot = new TelegramBot(token, { polling: true });
    await this.setupMessageHandlers();
    this.isInitialized = true;
    console.log('Telegram bot initialized successfully');
  
    // === AI Assist MVP commands ===
    await this.bot.setMyCommands([
      { command: 'start', description: 'Начать' },
      { command: 'stop', description: 'Передать диалог менеджеру' },
      { command: 'price', description: 'Цена по SKU' },
      { command: 'find', description: 'Поиск товара' },
      { command: 'promo', description: 'Каталог/акции' },
      { command: 'order', description: 'Создать заявку и оплату' }
    ]);

    // stop/hand-over
    this.bot.onText(/\/stop/, async (msg) => {
      const chatId = msg.chat.id;
      await this.bot!.sendMessage(chatId, 'Передал диалог менеджеру. Ожидайте, он подключится.');
      const groupId = process.env.TELEGRAM_OPERATORS_GROUP_ID;
      if (groupId) {
        await this.bot!.sendMessage(Number(groupId), `Хэндовер: чат ${chatId} передан менеджеру.`);
      }
      await storage.incrementCommandUsage('/stop', 'telegram');
    });

    // price
    this.bot.onText(/\/price (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const sku = (match?.[1] || '').trim();
      if (!sku) return this.bot!.sendMessage(chatId, 'Укажите SKU: /price <sku>');
      const sheetId = process.env.PRICES_SHEET_ID as string;
      const range = process.env.PRICES_RANGE || 'Sheet1!A:Z';
      try {
        const item = await getPriceBySku(sheetId, range, sku);
        if (!item) return this.bot!.sendMessage(chatId, 'Не нашел такой SKU');
        let text = `${item.Name} — ${item.Price} ${item.Currency || ''}\nSKU: ${item.SKU}`;
        if (item.PhotoURL) await this.bot!.sendPhoto(chatId, item.PhotoURL, { caption: text });
        else await this.bot!.sendMessage(chatId, text);
        await storage.incrementCommandUsage('/price', 'telegram');
      } catch (e:any) {
        await this.bot!.sendMessage(chatId, 'Ошибка при получении цены');
      }
    });

    // find
    this.bot.onText(/\/find (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const q = (match?.[1] || '').trim();
      const sheetId = process.env.PRICES_SHEET_ID as string;
      const range = process.env.PRICES_RANGE || 'Sheet1!A:Z';
      try {
        const items = await searchProducts(sheetId, range, q);
        if (!items.length) return this.bot!.sendMessage(chatId, 'Ничего не найдено');
        const top = items.slice(0,5).map(i => `• ${i.Name} — ${i.Price} ${i.Currency || ''} (SKU ${i.SKU})`).join('\n');
        await this.bot!.sendMessage(chatId, top);
        await storage.incrementCommandUsage('/find', 'telegram');
      } catch (e:any) {
        await this.bot!.sendMessage(chatId, 'Ошибка поиска');
      }
    });

    // promo
    this.bot.onText(/\/promo/, async (msg) => {
      const chatId = msg.chat.id;
      const url = process.env.PROMO_URL || 'https://example.com';
      await this.bot!.sendMessage(chatId, 'Каталог и акции:', {
        reply_markup: { inline_keyboard: [[{ text: 'Открыть', url }]] } as any
      });
      await storage.incrementCommandUsage('/promo', 'telegram');
    });

    // order -> create lead + QR
    this.bot.onText(/\/order/, async (msg) => {
      const chatId = msg.chat.id;
      const leadsSheetId = process.env.LEADS_SHEET_ID;
      const leadsRange = process.env.LEADS_RANGE || 'Sheet1!A:Z';
      const leadId = 'ld_' + Date.now();
      try {
        if (leadsSheetId) {
          await appendRow(leadsSheetId, leadsRange, [leadId, 'tg', msg.from?.username || '', '', '[]', 0, 'NEW', new Date().toISOString()]);
        }
        const png = await generateQrPngBuffer(`pay://${leadId}`);
        await this.bot!.sendPhoto(chatId, png, { caption: 'Отсканируйте QR для оплаты' });
        const groupId = process.env.TELEGRAM_OPERATORS_GROUP_ID;
        if (groupId) await this.bot!.sendMessage(Number(groupId), `Новая заявка ${leadId} из чата ${chatId}`);
        await storage.incrementCommandUsage('/order', 'telegram');
        
        // Store in memory as well
        await storage.createLead({
          leadId,
          channel: 'telegram',
          name: msg.from?.username || '',
          phone: '',
          items: [],
          sum: 0,
          status: 'NEW'
        });
      } catch (e:any) {
        await this.bot!.sendMessage(chatId, 'Не удалось создать заявку');
      }
    });

    // start with keyboard
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const keyboard = {
        keyboard: [[{ text: '🧭 Навигация (2GIS)' }, { text: '📞 Перезвонить' }]],
        resize_keyboard: true
      };
      await this.bot!.sendMessage(chatId, 'Выберите действие или опишите ваш запрос:', { reply_markup: keyboard as any });
      const first = funnelService.start(chatId, 'ru' as any);
      await this.bot!.sendMessage(chatId, first);
      await storage.incrementCommandUsage('/start', 'telegram');
      
      // Store conversation
      await storage.createConversation({
        chatId: chatId.toString(),
        channel: 'telegram',
        userId: msg.from?.id.toString(),
        userName: msg.from?.username || msg.from?.first_name || '',
        lastMessage: '/start',
        status: 'active'
      });
    });

    // 2GIS + Перезвон (text buttons)
    this.bot.on('message', async (msg) => {
      if (!msg.text) return;
      const text = msg.text.trim().toLowerCase();
      const chatId = msg.chat.id;
      if (text.includes('навигац') || text.includes('2gis')) {
        const url = process.env.TWO_GIS_URL || 'https://2gis.kz';
        return this.bot!.sendMessage(chatId, url);
      }
      if (text.includes('перезвон')) {
        const leadsSheetId = process.env.CALLBACKS_SHEET_ID || process.env.LEADS_SHEET_ID;
        const leadsRange = process.env.CALLBACKS_RANGE || process.env.LEADS_RANGE || 'Sheet1!A:Z';
        if (leadsSheetId) {
          await appendRow(leadsSheetId, leadsRange, ['cb_' + Date.now(), 'tg', msg.from?.username || '', msg.contact?.phone_number || '', 'CALLBACK', new Date().toISOString()]);
        }
        const groupId = process.env.TELEGRAM_OPERATORS_GROUP_ID;
        if (groupId) await this.bot!.sendMessage(Number(groupId), `Запрошен перезвон из чата ${chatId}`);
        return this.bot!.sendMessage(chatId, 'Принято. Менеджер скоро перезвонит.');
      }
    });

    // language + 3-step funnel as fallback
    this.bot.on('message', async (msg) => {
      if (!msg.text) return;
      if (msg.text.startsWith('/')) return; // skip commands
      const chatId = msg.chat.id;
      const t = msg.text || '';
      
      // Update conversation
      await storage.updateConversation(chatId.toString(), {
        lastMessage: t,
        updatedAt: new Date()
      });
      
      if (!(funnelService as any).sessions?.has(chatId)) {
        const lang = detectLang(t);
        const first = funnelService.start(chatId, lang as any);
        await this.bot!.sendMessage(chatId, first);
      } else {
        const reply = funnelService.next(chatId, t);
        if (reply) await this.bot!.sendMessage(chatId, reply);
      }
    });
    // === End of AI Assist MVP commands ===
  }

  private async setupMessageHandlers() {
    if (!this.bot) return;

    this.bot.on('error', (error) => {
      console.error('Telegram bot error:', error);
      storage.updateSystemStatus('Telegram Bot', 'error', error.message);
    });
  }

  private async setupCommands() {
    if (!this.bot) return;
    // Commands are set up in initialize method
  }

  async sendMessage(chatId: number, text: string) {
    if (!this.isInitialized || !this.bot) {
      throw new Error('Telegram bot not initialized');
    }
    return this.bot.sendMessage(chatId, text);
  }

  async sendPhoto(chatId: number, photo: string | Buffer, options?: any) {
    if (!this.isInitialized || !this.bot) {
      throw new Error('Telegram bot not initialized');
    }
    return this.bot.sendPhoto(chatId, photo, options);
  }
}

export const telegramBotService = new TelegramBotService();
