// server/routes.ts
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";

import { storage } from "./storage";
import { getWAClient } from "./integrations/whatsapp/factory";
import {
  getPriceBySku,
  searchProducts,
  appendRow,
} from "./integrations/google/sheets";
import { generateQrPngBuffer } from "./services/qr";
import { telegramBotService } from "./services/telegramBot";
import { funnelService } from "./services/funnel";
import { detectLang } from "./services/langDetect";
import { normalizeIncoming } from "./services/normalizer";
import { transcribeAudio } from "./services/asr";
import { synthesizeSpeech } from "./services/tts";
import { handleDialog } from "./dialog/orchestrator";
import TelegramBot from "node-telegram-bot-api";

// Initialize bot for webhook response sending
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN || "", { polling: false });

/**
 * registerRoutes(app) — регистрирует все публичные эндпоинты.
 * Возвращает http.Server (createServer(app)) чтобы внешняя обвязка могла слушать порт.
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Инициализация Telegram бота — пробуем безопасно
  try {
    await telegramBotService.initialize();
    console.info("[routes] telegramBotService initialized");
  } catch (err) {
    // не фэйлим стартап приложения — бот может инициализироваться позднее
    console.warn("[routes] telegramBotService init failed:", err);
  }

  // ---------- Tenants ----------
  app.get("/api/tenants", async (_req: Request, res: Response) => {
    try {
      const t = await storage.getTenants();
      res.json(t);
    } catch (err: any) {
      console.error("GET /api/tenants error", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.post("/api/tenants", async (req: Request, res: Response) => {
    try {
      const created = await storage.createTenant(req.body || {});
      res.json(created);
    } catch (err: any) {
      console.error("POST /api/tenants error", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.patch("/api/tenants/:id", async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateTenant(req.params.id, req.body || {});
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (err: any) {
      console.error("PATCH /api/tenants/:id error", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.delete("/api/tenants/:id", async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteTenant(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Not found" });
      res.json({ success: true });
    } catch (err: any) {
      console.error("DELETE /api/tenants/:id error", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // ---------- Multi-tenant Webhooks ----------
  // Telegram webhook
  app.post("/webhook/tg/:tenantKey", async (req: Request, res: Response) => {
    try {
      // normalizeIncoming → ASR (если voice/audio) → orchestrator → отправка ответа (text + voice при необходимости)
      const normalized = await normalizeIncoming(req);
      
      // ASR для голосовых сообщений
      if (normalized.kind === "voice" || normalized.kind === "audio") {
        if (normalized.mediaUrl) {
          const transcribedText = await transcribeAudio(normalized.mediaUrl, normalized.lang);
          normalized.text = transcribedText;
          normalized.kind = "text"; // Конвертируем в текст после ASR
        }
      }
      
      // Найти тенанта по tenantKey
      const tenant = await storage.getTenantByKey(normalized.tenantKey);
      if (!tenant || !tenant.active) {
        console.warn(`[TG webhook] Invalid or inactive tenant: ${normalized.tenantKey}`);
        return res.status(404).json({ error: 'Tenant not found or inactive' });
      }
      
      // Resolve customer ID (for now use chatId as customerId, in real app this would be database lookup)
      const customerId = parseInt(normalized.chatId) || 1;
      const tenantId = parseInt(tenant.id) || 1; // Convert to number as expected by handleDialog
      
      // Обработка диалога
      const response = await handleDialog({
        msg: normalized,
        customerId,
        tenantId
      });
      
      // Отправка ответа через Telegram Bot API
      try {
        if (response.text) {
          await bot.sendMessage(normalized.chatId, response.text);
        }
        
        // Handle voice response if TTS is enabled
        if ((response as any).tts) {
          // TODO: Send voice message with TTS buffer
          console.log("TTS response available but voice sending not implemented yet");
        }
        
        // Handle attachments
        if ((response as any).attachments?.length) {
          for (const attachment of (response as any).attachments) {
            if (attachment.type === "image") {
              await bot.sendPhoto(normalized.chatId, attachment.url);
            } else if (attachment.type === "file") {
              await bot.sendDocument(normalized.chatId, attachment.url);
            }
          }
        }
      } catch (sendError) {
        console.error("Failed to send Telegram response:", sendError);
      }
      
      res.sendStatus(200);
    } catch (error) {
      console.error("Telegram webhook error:", error);
      res.sendStatus(500);
    }
  });

  // WhatsApp webhook
  app.post("/webhook/wa", async (req: Request, res: Response) => {
    try {
      // resolve tenant by phone_id/metadata → normalizeIncoming → ASR → orchestrator → ответ
      const normalized = await normalizeIncoming(req);
      
      // ASR для голосовых сообщений
      if (normalized.kind === "voice" || normalized.kind === "audio") {
        if (normalized.mediaUrl) {
          const transcribedText = await transcribeAudio(normalized.mediaUrl, normalized.lang);
          normalized.text = transcribedText;
          normalized.kind = "text";
        }
      }
      
      // Найти тенанта по WhatsApp phone_id
      const metadata = req.body.entry?.[0]?.changes?.[0]?.value?.metadata;
      const phoneId = metadata?.phone_number_id || metadata?.display_phone_number;
      
      let tenant;
      if (phoneId) {
        // Find tenant by WhatsApp phone ID
        const tenants = await storage.getTenants();
        tenant = tenants.find(t => t.waPhoneId === phoneId && t.active);
      }
      
      // Fallback to default tenant if no specific tenant found
      if (!tenant) {
        tenant = await storage.getTenantByKey('default');
      }
      
      if (!tenant || !tenant.active) {
        console.warn(`[WA webhook] No active tenant found for phone_id: ${phoneId}`);
        return res.status(404).json({ error: 'Tenant not found or inactive' });
      }
      
      // Update normalized message with resolved tenant key
      normalized.tenantKey = tenant.key;
      
      // Resolve customer ID (for now use chatId as customerId, in real app this would be database lookup)
      const customerId = parseInt(normalized.chatId) || 1;
      const tenantId = parseInt(tenant.id) || 1; // Convert to number as expected by handleDialog
      
      // Обработка диалога
      const response = await handleDialog({
        msg: normalized,
        customerId,
        tenantId
      });
      
      // Отправка ответа через WhatsApp API
      try {
        const waClient = getWAClient();
        
        if (response.text) {
          await waClient.sendText(normalized.chatId, response.text);
        }
        
        // Handle voice response if TTS is enabled
        if ((response as any).tts) {
          // TODO: Send voice message with TTS buffer
          console.log("TTS response available but voice sending not implemented yet");
        }
        
        // Handle attachments
        if ((response as any).attachments?.length) {
          for (const attachment of (response as any).attachments) {
            // TODO: Implement WhatsApp media sending
            console.log(`WhatsApp attachment sending not implemented: ${attachment.type} - ${attachment.url}`);
          }
        }
      } catch (sendError) {
        console.error("Failed to send WhatsApp response:", sendError);
      }
      
      res.sendStatus(200);
    } catch (error) {
      console.error("WhatsApp webhook error:", error);
      res.sendStatus(500);
    }
  });

  // ---------- Catalog API ----------
  app.get("/api/catalog/search", async (req: Request, res: Response) => {
    try {
      const { q, tenant, limit = 20 } = req.query;
      const { catalogService } = await import("../services/catalog");
      const results = await catalogService.searchProducts(
        String(tenant),
        String(q),
        Number(limit)
      );
      res.json({ results, query: q, tenant, limit });
    } catch (error) {
      console.error("Catalog search error:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.get("/api/catalog/sku/:sku", async (req: Request, res: Response) => {
    try {
      const { sku } = req.params;
      const { tenant } = req.query;
      const { catalogService } = await import("../services/catalog");
      const product = await catalogService.getProductBySku(
        String(tenant),
        sku
      );
      res.json({ sku, tenant, product });
    } catch (error) {
      console.error("Catalog SKU error:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // ---------- Cart/Order/Lead API ----------
  app.post("/api/cart/add", async (req: Request, res: Response) => {
    try {
      const { tenant, chat_id, sku, qty } = req.body;
      // TODO: Добавить товар в корзину
      res.json({ success: true, tenant, chat_id, sku, qty });
    } catch (error) {
      console.error("Cart add error:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.get("/api/cart", async (req: Request, res: Response) => {
    try {
      const { tenant, chat_id } = req.query;
      // TODO: Получить корзину клиента
      res.json({ items: [], tenant, chat_id });
    } catch (error) {
      console.error("Cart get error:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.post("/api/order/checkout", async (req: Request, res: Response) => {
    try {
      const { tenant, chat_id, delivery, payment } = req.body;
      // TODO: Оформление заказа
      res.json({ success: true, orderId: "placeholder", tenant, chat_id });
    } catch (error) {
      console.error("Order checkout error:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.post("/api/lead", async (req: Request, res: Response) => {
    try {
      const { tenant, customer_id, need_by_date, comment } = req.body;
      // TODO: Создание лида
      res.json({ success: true, leadId: "placeholder", tenant });
    } catch (error) {
      console.error("Lead creation error:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // ---------- Docs Generation ----------
  app.post("/api/docs/quote", async (req: Request, res: Response) => {
    try {
      const { tenant, lead_id, customerData, items } = req.body;
      // TODO: Implement document service
      const fileUrl = null; // documentService.generateQuote not implemented yet
      /*
      const documentService = await import("../services/documents");
      const fileUrl = await documentService.documentService.generateQuote(
        String(tenant),
        String(lead_id),
        {
          customerName: customerData.name,
          customerEmail: customerData.email,
          customerPhone: customerData.phone,
          items: items || [],
          deliveryAddress: customerData.address,
          notes: customerData.notes,
        }
      );
      */
      res.json({ success: !!fileUrl, fileUrl, tenant });
    } catch (error) {
      console.error("Quote generation error:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.post("/api/docs/invoice", async (req: Request, res: Response) => {
    try {
      const { tenant, order_id, orderData, items } = req.body;
      // TODO: Implement document service
      const fileUrl = null; // documentService.generateInvoice not implemented yet
      /*
      const documentService = await import("../services/documents");
      const fileUrl = await documentService.documentService.generateInvoice(
        String(tenant),
        String(order_id),
        {
          orderNumber: orderData.orderNumber,
          customerName: orderData.customerName,
          customerEmail: orderData.customerEmail,
          customerPhone: orderData.customerPhone,
          items: items || [],
          deliveryAddress: orderData.deliveryAddress,
          paymentMethod: orderData.paymentMethod,
          dueDate: orderData.dueDate ? new Date(orderData.dueDate) : undefined,
        }
      );
      */
      res.json({ success: !!fileUrl, fileUrl, tenant });
    } catch (error) {
      console.error("Invoice generation error:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // ---------- AI Industry Configs ----------
  app.get("/api/ai/industries", async (_req: Request, res: Response) => {
    try {
      const items = await storage.getIndustryConfigs();
      const configured = items.filter((i) => i.systemPrompt?.trim()).length;
      const active = items.filter((i) => i.active).length;
      const totalUsers = items.reduce((a, i) => a + (i.usersCount || 0), 0);
      res.json({ items, stats: { configured, active, totalUsers } });
    } catch (err: any) {
      console.error("GET /api/ai/industries error", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.post("/api/ai/industries", async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        key: string;
        title: string;
        active?: boolean;
        usersCount?: number;
        systemPrompt?: string;
      };
      if (!body?.key || !body?.title)
        return res.status(400).json({ error: "key and title required" });

      const created = await storage.createIndustryConfig({
        key: body.key as any,
        title: body.title,
        active: !!body.active,
        usersCount: body.usersCount ?? 0,
        systemPrompt: body.systemPrompt ?? "",
      });
      res.json(created);
    } catch (err: any) {
      console.error("POST /api/ai/industries error", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.patch("/api/ai/industries/:id", async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateIndustryConfig(
        req.params.id,
        req.body || {},
      );
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (err: any) {
      console.error("PATCH /api/ai/industries/:id error", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // ---------- Dashboard / admin endpoints ----------
  app.get("/api/dashboard/stats", async (_req: Request, res: Response) => {
    try {
      const conversations = await storage.getConversations();
      const leads = await storage.getLeads();

      const activeConversations = conversations.filter(
        (c) => c.status === "active",
      ).length;

      const today = new Date().toDateString();
      const newLeads = leads.filter((l) => {
        const leadDate = new Date(l.createdAt || 0);
        return leadDate.toDateString() === today;
      }).length;

      const ordersToday = leads.filter((l) => {
        const leadDate = new Date(l.createdAt || 0);
        return (
          leadDate.toDateString() === today &&
          (l.status || "").toUpperCase() === "PAID"
        );
      }).length;

      res.json({
        activeConversations,
        newLeads,
        ordersToday,
        responseRate: 94.2,
      });
    } catch (err: any) {
      console.error("GET /api/dashboard/stats error", err);
      res.status(500).json({ error: err.message || "internal_error" });
    }
  });

  app.get("/api/conversations", async (_req: Request, res: Response) => {
    try {
      const conversations = await storage.getConversations();
      res.json(conversations.slice(0, 10));
    } catch (err: any) {
      console.error("GET /api/conversations error", err);
      res.status(500).json({ error: err.message || "internal_error" });
    }
  });

  app.get("/api/leads", async (_req: Request, res: Response) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (err: any) {
      console.error("GET /api/leads error", err);
      res.status(500).json({ error: err.message || "internal_error" });
    }
  });

  app.get("/api/commands", async (_req: Request, res: Response) => {
    try {
      const commands = await storage.getBotCommands();
      res.json(commands.slice(0, 10));
    } catch (err: any) {
      console.error("GET /api/commands error", err);
      res.status(500).json({ error: err.message || "internal_error" });
    }
  });

  app.get("/api/system-status", async (_req: Request, res: Response) => {
    try {
      const status = await storage.getSystemStatus();
      res.json(status);
    } catch (err: any) {
      console.error("GET /api/system-status error", err);
      res.status(500).json({ error: err.message || "internal_error" });
    }
  });

  // Products (in-memory or storage-backed)
  app.get("/api/products", async (_req: Request, res: Response) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (err: any) {
      console.error("GET /api/products error", err);
      res.status(500).json({ error: err.message || "internal_error" });
    }
  });

  app.get("/api/products/search", async (req: Request, res: Response) => {
    try {
      const query = String(req.query.q || "");
      if (!query) return res.json([]);
      const products = await storage.searchProducts(query);
      res.json(products);
    } catch (err: any) {
      console.error("GET /api/products/search error", err);
      res.status(500).json({ error: err.message || "internal_error" });
    }
  });

  // === AI Assist MVP routes (catalog/pricing/leads/wa/qr) ===
  app.get("/api/catalog/price/:sku", async (req: Request, res: Response) => {
    try {
      const sheetId = process.env.PRICES_SHEET_ID as string;
      const range = process.env.PRICES_RANGE || "Sheet1!A:Z";
      if (!sheetId)
        return res.status(400).json({ error: "PRICES_SHEET_ID not set" });

      const item = await getPriceBySku(sheetId, range, req.params.sku);
      if (!item) return res.status(404).json({ error: "SKU not found" });
      res.json(item);
    } catch (err: any) {
      console.error("GET /api/catalog/price/:sku error", err);
      res.status(500).json({ error: err.message || "Failed" });
    }
  });

  app.get("/api/catalog/search", async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q || "");
      const sheetId = process.env.PRICES_SHEET_ID as string;
      const range = process.env.PRICES_RANGE || "Sheet1!A:Z";
      if (!sheetId)
        return res.status(400).json({ error: "PRICES_SHEET_ID not set" });
      const items = (await searchProducts(sheetId, range, q)) as any[];
      res.json(items);
    } catch (err: any) {
      console.error("GET /api/catalog/search error", err);
      res.status(500).json({ error: err.message || "Failed" });
    }
  });

  app.post("/api/leads", async (req: Request, res: Response) => {
    try {
      const { channel, name, phone, items, sum } = req.body || {};
      const leadId = "ld_" + Date.now();
      const leadsSheetId = process.env.LEADS_SHEET_ID;
      const leadsRange = process.env.LEADS_RANGE || "Sheet1!A:Z";
      if (leadsSheetId) {
        await appendRow(leadsSheetId, leadsRange, [
          leadId,
          channel || "web",
          name || "",
          phone || "",
          JSON.stringify(items || []),
          sum || 0,
          "NEW",
          new Date().toISOString(),
        ]);
      }

      await storage.createLead({
        leadId,
        channel: channel || "web",
        name: name || "",
        phone: phone || "",
        items: items || [],
        sum: sum || 0,
        status: "NEW",
      });

      const qr = await generateQrPngBuffer(`pay://${leadId}`);
      res.setHeader("Content-Type", "image/png");
      res.send(qr);
    } catch (err: any) {
      console.error("POST /api/leads error", err);
      res.status(500).json({ error: err.message || "Failed" });
    }
  });

  app.post("/api/payments/qr/callback", async (req: Request, res: Response) => {
    try {
      const sig = req.header("x-signature");
      if (!sig || sig !== process.env.PAYMENT_CALLBACK_SECRET)
        return res.status(403).json({ error: "bad signature" });
      // TODO: mark lead as PAID in Google Sheets by LeadID
      res.json({ ok: true });
    } catch (err: any) {
      console.error("POST /api/payments/qr/callback error", err);
      res.status(500).json({ error: err.message || "Failed" });
    }
  });

  // WhatsApp webhook (360dialog style)
  app.post("/api/whatsapp/webhook", async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const msg = (body.messages && body.messages[0]) || null;
      if (!msg) return res.json({ ok: true });
      const from = msg.from || (msg.sender && msg.sender.id);
      let text = "";
      if (msg.text && msg.text.body) text = msg.text.body;
      else if (msg.button && msg.button.text) text = msg.button.text;
      else if (
        msg.interactive &&
        msg.interactive.button_reply &&
        msg.interactive.button_reply.title
      )
        text = msg.interactive.button_reply.title;
      if (!from) return res.json({ ok: true });

      const wa = getWAClient();

      await storage.createConversation({
        chatId: from,
        channel: "whatsapp",
        userId: from,
        userName: "",
        lastMessage: text,
        status: "active",
      });

      const lower = String(text || "")
        .trim()
        .toLowerCase();
      const sheetId = process.env.PRICES_SHEET_ID as string;
      const range = process.env.PRICES_RANGE || "Sheet1!A:Z";

      if (lower.startsWith("/price")) {
        const parts = lower.split(" ").filter(Boolean);
        const sku = parts[1];
        if (!sku) {
          await wa.sendText(from, "Укажите SKU: /price <sku>");
        } else {
          const item = await getPriceBySku(sheetId, range, sku);
          if (!item) await wa.sendText(from, "Не нашел такой SKU");
          else
            await wa.sendText(
              from,
              `${item.Name} — ${item.Price} ${item.Currency || ""} (SKU ${item.SKU})`,
            );
        }
        await storage.incrementCommandUsage("/price", "whatsapp");
        return res.json({ ok: true });
      }

      if (lower.startsWith("/find")) {
        const q = lower.replace("/find", "").trim();
        const items = await searchProducts(sheetId, range, q);
        if (!items.length) await wa.sendText(from, "Ничего не найдено");
        else {
          const top = items
            .slice(0, 5)
            .map(
              (i) =>
                `• ${i.Name} — ${i.Price} ${i.Currency || ""} (SKU ${i.SKU})`,
            )
            .join("\n");
          await wa.sendText(from, top);
        }
        await storage.incrementCommandUsage("/find", "whatsapp");
        return res.json({ ok: true });
      }

      if (lower.startsWith("/order")) {
        const leadsSheetId = process.env.LEADS_SHEET_ID;
        const leadsRange = process.env.LEADS_RANGE || "Sheet1!A:Z";
        const leadId = "ld_" + Date.now();
        if (leadsSheetId) {
          await appendRow(leadsSheetId, leadsRange, [
            leadId,
            "wa",
            from,
            "",
            "[]",
            0,
            "NEW",
            new Date().toISOString(),
          ]);
        }
        await storage.createLead({
          leadId,
          channel: "whatsapp",
          name: from,
          phone: "",
          items: [],
          sum: 0,
          status: "NEW",
        });
        await wa.sendText(
          from,
          "Заявка создана. Мы пришлём ссылку/QR для оплаты.",
        );
        await storage.incrementCommandUsage("/order", "whatsapp");
        return res.json({ ok: true });
      }

      if (lower.includes("2gis") || lower.includes("навигац")) {
        const url = process.env.TWO_GIS_URL || "https://2gis.kz";
        await wa.sendText(from, url);
        return res.json({ ok: true });
      }
      if (lower.includes("перезвон")) {
        const cbSheetId =
          process.env.CALLBACKS_SHEET_ID || process.env.LEADS_SHEET_ID;
        const cbRange =
          process.env.CALLBACKS_RANGE ||
          process.env.LEADS_RANGE ||
          "Sheet1!A:Z";
        if (cbSheetId) {
          await appendRow(cbSheetId, cbRange, [
            "cb_" + Date.now(),
            "wa",
            from,
            "",
            "CALLBACK",
            new Date().toISOString(),
          ]);
        }
        await wa.sendText(from, "Принято. Менеджер перезвонит.");
        return res.json({ ok: true });
      }

      // AI-powered funnel
      if (!funnelService.has(from)) {
        const first = funnelService.start(from, detectLang(text) as any);
        await wa.sendText(from, first);
      } else {
        try {
          const aiResponse = await funnelService.generateAIResponse(from, text);
          if (aiResponse) {
            await wa.sendText(from, aiResponse);
          } else {
            const reply = funnelService.next(from, text);
            if (reply) await wa.sendText(from, reply);
          }
        } catch (err) {
          const reply = funnelService.next(from, text);
          if (reply) await wa.sendText(from, reply);
        }
      }
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("WA webhook error", err);
      // не даём провайдеру бесконечные retries — возвращаем 200/ok
      return res.status(200).json({ ok: true });
    }
  });

  // AI Settings
  app.get("/api/ai/settings", async (_req: Request, res: Response) => {
    try {
      const settings = {
        industry: process.env.AI_INDUSTRY || "retail",
        personality: process.env.AI_PERSONALITY || "professional",
        temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
        maxTokens: parseInt(process.env.AI_MAX_TOKENS || "1000"),
        contextMemory: process.env.AI_CONTEXT_MEMORY !== "false",
        smartRecommendations: process.env.AI_SMART_RECOMMENDATIONS !== "false",
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        apiKeySet: !!process.env.OPENAI_API_KEY,
      };
      res.json(settings);
    } catch (err: any) {
      console.error("GET /api/ai/settings error", err);
      res.status(500).json({ error: err.message || "internal_error" });
    }
  });

  // AI Product Recommendations
  app.post("/api/ai/recommendations", async (req: Request, res: Response) => {
    try {
      const { query } = req.body || {};
      if (!query) return res.status(400).json({ error: "Query is required" });

      const sheetId = process.env.PRICES_SHEET_ID as string;
      const range = process.env.PRICES_RANGE || "Sheet1!A:Z";
      if (!sheetId)
        return res
          .status(500)
          .json({ error: "Product catalog not configured" });

      // Получаем продукты — гарантируем массив
      const _productsRaw = await searchProducts(sheetId, range, query);
      const products = Array.isArray(_productsRaw)
        ? _productsRaw
        : _productsRaw
          ? [_productsRaw]
          : [];

      // Если ничего не найдено — быстро ответим
      if (!products.length) {
        return res.json({
          recommendations:
            "К сожалению, по вашему запросу ничего не найдено. Попробуйте уточнить запрос или свяжитесь с нашим менеджером.",
        });
      }

      // Динамически импортируем генератор рекомендаций и вызываем его
      const { generateProductRecommendations } = await import(
        "./services/openai"
      );

      let recommendations;
      try {
        recommendations = await generateProductRecommendations(
          query,
          products as unknown as any[], // безопасный cast для TypeScript
          {
            industry: process.env.AI_INDUSTRY,
            personality: process.env.AI_PERSONALITY,
            temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
            maxTokens: parseInt(process.env.AI_MAX_TOKENS || "500"),
          },
        );
      } catch (err: any) {
        console.error("generateProductRecommendations failed:", err);
        return res
          .status(500)
          .json({ error: "Failed to generate recommendations" });
      }

      // Возвращаем рекомендации и первые 5 продуктов
      return res.json({ recommendations, products: products.slice(0, 5) });
    } catch (err: any) {
      console.error("POST /api/ai/recommendations error", err);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

export default registerRoutes;
