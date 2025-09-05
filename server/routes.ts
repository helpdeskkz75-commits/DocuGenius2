import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getWAClient } from "./integrations/whatsapp/factory";
import { getPriceBySku, searchProducts, appendRow } from "./integrations/google/sheets";
import { generateQrPngBuffer } from "./services/qr";
import { telegramBotService } from "./services/telegramBot";
import { funnelService } from "./services/funnel";
import { detectLang } from "./services/langDetect";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Telegram bot
  await telegramBotService.initialize();

  // Dashboard API endpoints
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const conversations = await storage.getConversations();
      const leads = await storage.getLeads();
      const commands = await storage.getBotCommands();
      
      const activeConversations = conversations.filter(c => c.status === 'active').length;
      const newLeads = leads.filter(l => {
        const today = new Date();
        const leadDate = new Date(l.createdAt || 0);
        return leadDate.toDateString() === today.toDateString();
      }).length;
      const ordersToday = leads.filter(l => {
        const today = new Date();
        const leadDate = new Date(l.createdAt || 0);
        return leadDate.toDateString() === today.toDateString() && l.status === 'PAID';
      }).length;

      res.json({
        activeConversations,
        newLeads,
        ordersToday,
        responseRate: 94.2
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/conversations", async (req, res) => {
    try {
      const conversations = await storage.getConversations();
      res.json(conversations.slice(0, 10)); // Latest 10
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/leads", async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/commands", async (req, res) => {
    try {
      const commands = await storage.getBotCommands();
      res.json(commands.slice(0, 10)); // Top 10
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/system-status", async (req, res) => {
    try {
      const status = await storage.getSystemStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.json([]);
      }
      const products = await storage.searchProducts(query);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // === AI Assist MVP routes (catalog/pricing/leads/wa/qr) ===
  app.get("/api/catalog/price/:sku", async (req, res) => {
    try {
      const sheetId = process.env.PRICES_SHEET_ID as string;
      const range = process.env.PRICES_RANGE || "Sheet1!A:Z";
      if (!sheetId) return res.status(400).json({ error: "PRICES_SHEET_ID not set" });
      const item = await getPriceBySku(sheetId, range, req.params.sku);
      if (!item) return res.status(404).json({ error: "SKU not found" });
      res.json(item);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed" });
    }
  });

  app.get("/api/catalog/search", async (req, res) => {
    try {
      const q = String(req.query.q || "");
      const sheetId = process.env.PRICES_SHEET_ID as string;
      const range = process.env.PRICES_RANGE || "Sheet1!A:Z";
      if (!sheetId) return res.status(400).json({ error: "PRICES_SHEET_ID not set" });
      const items = await searchProducts(sheetId, range, q);
      res.json(items);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed" });
    }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const { channel, name, phone, items, sum } = req.body || {};
      const leadId = "ld_" + Date.now();
      const leadsSheetId = process.env.LEADS_SHEET_ID;
      const leadsRange = process.env.LEADS_RANGE || "Sheet1!A:Z";
      if (leadsSheetId) {
        await appendRow(
          leadsSheetId, leadsRange,
          [leadId, channel || 'web', name || '', phone || '', JSON.stringify(items||[]), sum || 0, "NEW", new Date().toISOString()]
        );
      }
      
      // Store in memory as well
      await storage.createLead({
        leadId,
        channel: channel || 'web',
        name: name || '',
        phone: phone || '',
        items: items || [],
        sum: sum || 0,
        status: 'NEW'
      });
      
      const qr = await generateQrPngBuffer(`pay://${leadId}`);
      res.setHeader("Content-Type", "image/png");
      res.send(qr);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed" });
    }
  });

  app.post("/api/payments/qr/callback", async (req, res) => {
    const sig = req.header("x-signature");
    if (!sig || sig !== process.env.PAYMENT_CALLBACK_SECRET) return res.status(403).json({ error: "bad signature" });
    // TODO: mark lead as PAID in Google Sheets by LeadID
    res.json({ ok: true });
  });

  app.post("/api/whatsapp/webhook", async (req, res) => {
    try {
      const body = req.body || {};
      // 360dialog typical payload: { contacts: [...], messages: [{ from, text: { body } }] }
      const msg = (body.messages && body.messages[0]) || null;
      if (!msg) return res.json({ ok: true });
      const from = msg.from || (msg.sender && msg.sender.id);
      let text = '';
      if (msg.text && msg.text.body) text = msg.text.body;
      else if (msg.button && msg.button.text) text = msg.button.text;
      else if (msg.interactive && msg.interactive.button_reply && msg.interactive.button_reply.title) text = msg.interactive.button_reply.title;
      if (!from) return res.json({ ok: true });

      const wa = getWAClient();

      // Store/update conversation
      await storage.createConversation({
        chatId: from,
        channel: 'whatsapp',
        userId: from,
        userName: '',
        lastMessage: text,
        status: 'active'
      });

      // Commands
      const lower = String(text || '').trim().toLowerCase();
      const sheetId = process.env.PRICES_SHEET_ID as string;
      const range = process.env.PRICES_RANGE || 'Sheet1!A:Z';

      if (lower.startsWith('/price')) {
        const parts = lower.split(' ').filter(Boolean);
        const sku = parts[1];
        if (!sku) {
          await wa.sendText(from, 'Укажите SKU: /price <sku>');
        } else {
          const item = await getPriceBySku(sheetId, range, sku);
          if (!item) await wa.sendText(from, 'Не нашел такой SKU');
          else await wa.sendText(from, `${item.Name} — ${item.Price} ${item.Currency || ''} (SKU ${item.SKU})`);
        }
        await storage.incrementCommandUsage('/price', 'whatsapp');
        return res.json({ ok: true });
      }

      if (lower.startsWith('/find')) {
        const q = lower.replace('/find', '').trim();
        const items = await searchProducts(sheetId, range, q);
        if (!items.length) await wa.sendText(from, 'Ничего не найдено');
        else {
          const top = items.slice(0,5).map(i => `• ${i.Name} — ${i.Price} ${i.Currency || ''} (SKU ${i.SKU})`).join('\n');
          await wa.sendText(from, top);
        }
        await storage.incrementCommandUsage('/find', 'whatsapp');
        return res.json({ ok: true });
      }

      if (lower.startsWith('/order')) {
        const leadsSheetId = process.env.LEADS_SHEET_ID;
        const leadsRange = process.env.LEADS_RANGE || 'Sheet1!A:Z';
        const leadId = 'ld_' + Date.now();
        if (leadsSheetId) {
          await appendRow(leadsSheetId, leadsRange, [leadId, 'wa', from, '', '[]', 0, 'NEW', new Date().toISOString()]);
        }
        await storage.createLead({
          leadId,
          channel: 'whatsapp',
          name: from,
          phone: '',
          items: [],
          sum: 0,
          status: 'NEW'
        });
        await wa.sendText(from, 'Заявка создана. Мы пришлём ссылку/QR для оплаты.');
        await storage.incrementCommandUsage('/order', 'whatsapp');
        return res.json({ ok: true });
      }

      // 2GIS and callback keywords
      if (lower.includes('2gis') || lower.includes('навигац')) {
        const url = process.env.TWO_GIS_URL || 'https://2gis.kz';
        await wa.sendText(from, url);
        return res.json({ ok: true });
      }
      if (lower.includes('перезвон')) {
        const cbSheetId = process.env.CALLBACKS_SHEET_ID || process.env.LEADS_SHEET_ID;
        const cbRange = process.env.CALLBACKS_RANGE || process.env.LEADS_RANGE || 'Sheet1!A:Z';
        if (cbSheetId) {
          await appendRow(cbSheetId, cbRange, ['cb_' + Date.now(), 'wa', from, '', 'CALLBACK', new Date().toISOString()]);
        }
        await wa.sendText(from, 'Принято. Менеджер перезвонит.');
        return res.json({ ok: true });
      }

      // AI-powered responses with funnel fallback
      if (!funnelService.has(from)) {
        const first = funnelService.start(from, detectLang(text) as any);
        await wa.sendText(from, first);
      } else {
        // Try AI response if available, fallback to basic funnel
        try {
          const aiResponse = await funnelService.generateAIResponse(from, text);
          if (aiResponse) {
            await wa.sendText(from, aiResponse);
          } else {
            const reply = funnelService.next(from, text);
            if (reply) await wa.sendText(from, reply);
          }
        } catch (error) {
          // Fallback to basic funnel
          const reply = funnelService.next(from, text);
          if (reply) await wa.sendText(from, reply);
        }
      }
      return res.json({ ok: true });
    } catch (e: any) {
      console.error('WA webhook error', e);
      return res.status(200).json({ ok: true }); // don't retry storms on provider
    }
  });

  // AI Settings API
  app.get("/api/ai/settings", async (req, res) => {
    try {
      const settings = {
        industry: process.env.AI_INDUSTRY || 'retail',
        personality: process.env.AI_PERSONALITY || 'professional',
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1000'),
        contextMemory: process.env.AI_CONTEXT_MEMORY !== 'false',
        smartRecommendations: process.env.AI_SMART_RECOMMENDATIONS !== 'false',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        apiKeySet: !!process.env.OPENAI_API_KEY
      };
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI Product Recommendations
  app.post("/api/ai/recommendations", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      // Get products from Google Sheets
      const sheetId = process.env.PRICES_SHEET_ID as string;
      const range = process.env.PRICES_RANGE || 'Sheet1!A:Z';
      
      if (!sheetId) {
        return res.status(500).json({ error: 'Product catalog not configured' });
      }

      const products = await searchProducts(sheetId, range, query);
      
      if (products.length === 0) {
        return res.json({ 
          recommendations: 'К сожалению, по вашему запросу ничего не найдено. Попробуйте уточнить запрос или свяжитесь с нашим менеджером.' 
        });
      }

      // Generate AI recommendations
      const { generateProductRecommendations } = await import('./services/openai');
      const recommendations = await generateProductRecommendations(
        query, 
        products,
        {
          industry: process.env.AI_INDUSTRY,
          personality: process.env.AI_PERSONALITY,
          temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
          maxTokens: parseInt(process.env.AI_MAX_TOKENS || '500')
        }
      );

      res.json({ recommendations, products: products.slice(0, 5) });
    } catch (error: any) {
      console.error('AI recommendations error:', error);
      res.status(500).json({ error: 'Failed to generate recommendations' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
