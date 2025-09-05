import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';
import { getPriceBySku, searchProducts, appendRow } from '../integrations/google/sheets';
import { generateQrPngBuffer } from '../services/qr';
import { funnelService } from '../services/funnel';
import { detectLang } from '../services/langDetect';
import { audioTranscriptionService } from '../services/audioTranscription';

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
        // Try AI response if available, fallback to basic funnel
        try {
          const aiResponse = await funnelService.generateAIResponse(chatId, t);
          if (aiResponse) {
            await this.bot!.sendMessage(chatId, aiResponse);
          } else {
            const reply = funnelService.next(chatId, t);
            if (reply) await this.bot!.sendMessage(chatId, reply);
          }
        } catch (error) {
          // Fallback to basic funnel
          const reply = funnelService.next(chatId, t);
          if (reply) await this.bot!.sendMessage(chatId, reply);
        }
      }
    });
    // === Audio Message Processing ===
    
    // Handle voice messages
    this.bot.on('voice', async (msg) => {
      await this.handleAudioMessage(msg, 'voice');
    });

    // Handle audio files
    this.bot.on('audio', async (msg) => {
      await this.handleAudioMessage(msg, 'audio');
    });

    // Handle document audio files (e.g., .mp3, .wav uploaded as documents)
    this.bot.on('document', async (msg) => {
      if (msg.document && msg.document.mime_type?.startsWith('audio/')) {
        await this.handleAudioMessage(msg, 'document');
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

  /**
   * Handle audio message processing (voice, audio files, documents)
   */
  private async handleAudioMessage(msg: any, type: 'voice' | 'audio' | 'document') {
    const chatId = msg.chat.id;
    
    try {
      // Send typing indicator while processing
      await this.bot!.sendChatAction(chatId, 'typing');
      
      // Get file info based on message type
      let fileId: string;
      let duration: number | undefined;
      
      switch (type) {
        case 'voice':
          fileId = msg.voice.file_id;
          duration = msg.voice.duration;
          break;
        case 'audio':
          fileId = msg.audio.file_id;
          duration = msg.audio.duration;
          break;
        case 'document':
          fileId = msg.document.file_id;
          break;
        default:
          throw new Error('Unsupported audio type');
      }

      // Get file URL from Telegram
      const fileInfo = await this.bot!.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
      
      // Send status message
      const statusMsg = await this.bot!.sendMessage(chatId, '🎙️ Обрабатываю аудио сообщение...');
      
      // Transcribe audio
      const transcription = await audioTranscriptionService.processAudioMessage(fileUrl, fileInfo.file_path);
      
      // Edit status message with transcription
      await this.bot!.editMessageText(
        `🎙️ Распознанный текст:\n"${transcription.text}"\n\n⏳ Генерирую ответ...`,
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
        }
      );
      
      // Update conversation with transcribed text
      await storage.updateConversation(chatId.toString(), {
        lastMessage: `[Аудио] ${transcription.text}`,
        updatedAt: new Date()
      });

      // Process transcribed text as regular message
      await this.processTranscribedText(chatId, transcription.text, transcription);
      
      // Delete status message
      await this.bot!.deleteMessage(chatId, statusMsg.message_id);
      
    } catch (error: any) {
      console.error('Error processing audio message:', error);
      
      let errorMessage = '❌ Не удалось обработать аудио сообщение.';
      
      if (error.message.includes('too large')) {
        errorMessage = '❌ Аудио файл слишком большой (максимум 25МБ). Попробуйте отправить более короткую запись.';
      } else if (error.message.includes('download')) {
        errorMessage = '❌ Не удалось скачать аудио файл. Попробуйте ещё раз.';
      } else if (error.message.includes('Transcription failed')) {
        errorMessage = '❌ Не удалось распознать речь. Убедитесь, что запись содержит речь на русском или казахском языке.';
      }
      
      await this.bot!.sendMessage(chatId, errorMessage);
    }
  }

  /**
   * Process transcribed text through the bot's AI logic
   */
  private async processTranscribedText(chatId: number, text: string, transcription: any) {
    try {
      // Determine language for AI response
      const language = audioTranscriptionService.getLanguageForAI(transcription);
      
      // Check if there's an active funnel session
      if (!(funnelService as any).sessions?.has(chatId)) {
        // Start new funnel session with detected language
        const first = funnelService.start(chatId, language as any);
        await this.bot!.sendMessage(chatId, first);
      } else {
        // Process through existing funnel/AI logic
        try {
          const aiResponse = await funnelService.generateAIResponse(chatId, text);
          if (aiResponse) {
            // Add language indicator for user
            const languageEmoji = language === 'kk' ? '🇰🇿' : '🇷🇺';
            await this.bot!.sendMessage(chatId, `${languageEmoji} ${aiResponse}`);
          } else {
            const reply = funnelService.next(chatId, text);
            if (reply) await this.bot!.sendMessage(chatId, reply);
          }
        } catch (error) {
          // Fallback to basic funnel
          const reply = funnelService.next(chatId, text);
          if (reply) await this.bot!.sendMessage(chatId, reply);
        }
      }
    } catch (error) {
      console.error('Error processing transcribed text:', error);
      await this.bot!.sendMessage(chatId, 'Понял ваше сообщение, но возникла ошибка при обработке. Попробуйте ещё раз или напишите текстом.');
    }
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
