import {
  type User,
  type InsertUser,
  type Conversation,
  type InsertConversation,
  type Lead,
  type InsertLead,
  type Product,
  type InsertProduct,
  type BotCommand,
  type InsertBotCommand,
  type SystemStatus,
  type InsertSystemStatus,
  type IndustryConfig,
  type InsertIndustryConfig,
  industryKeys,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Conversation methods
  getConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(
    id: string,
    updates: Partial<Conversation>,
  ): Promise<Conversation | undefined>;

  // Lead methods
  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, updates: Partial<Lead>): Promise<Lead | undefined>;

  // Product methods
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  searchProducts(query: string): Promise<Product[]>;

  // Bot command methods
  getBotCommands(): Promise<BotCommand[]>;
  incrementCommandUsage(command: string, channel: string): Promise<void>;

  // System status methods
  getSystemStatus(): Promise<SystemStatus[]>;
  updateSystemStatus(
    serviceName: string,
    status: string,
    description?: string,
  ): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private conversations: Map<string, Conversation>;
  private leads: Map<string, Lead>;
  private products: Map<string, Product>;
  private botCommands: Map<string, BotCommand>;
  private systemStatus: Map<string, SystemStatus>;

  private industryConfigs = new Map<string, IndustryConfig>();

  // ---- AI Industry Configs ----
  async getIndustryConfigs(): Promise<IndustryConfig[]> {
    return Array.from(this.industryConfigs.values());
  }

  async getIndustryConfig(id: string): Promise<IndustryConfig | undefined> {
    return this.industryConfigs.get(id);
  }

  async createIndustryConfig(
    data: InsertIndustryConfig,
  ): Promise<IndustryConfig> {
    const id = randomUUID();
    const rec: IndustryConfig = { id, ...data };
    this.industryConfigs.set(id, rec);
    return rec;
  }

  async updateIndustryConfig(
    id: string,
    updates: Partial<IndustryConfig>,
  ): Promise<IndustryConfig | undefined> {
    const cur = this.industryConfigs.get(id);
    if (!cur) return undefined;
    const next = { ...cur, ...updates, id: cur.id };
    this.industryConfigs.set(id, next);
    return next;
  }

  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.leads = new Map();
    this.products = new Map();
    this.botCommands = new Map();
    this.systemStatus = new Map();

    // --- Seed AI industries ---
        const seed: InsertIndustryConfig[] = [
          {
            key: "dentistry",
            title: "Стоматология",
            active: true,
            usersCount: 24,
            systemPrompt:
    `Ты — помощник для создания документов и общения с клиентами в сфере стоматологии.
    При создании договоров учитывай специфику медицинских услуг:
    - Указывай необходимые лицензии и сертификаты
    - Включай информацию о гарантийных обязательствах
    - Учитывай особенности медправа РК
    - Используй профессиональную терминологию

    Всегда уточняй у пользователя:
    - Тип стоматологической услуги
    - Стоимость лечения
    - Сроки оказания услуги
    - Гарантийные обязательства`,
          },
          {
            key: "restaurant",
            title: "Ресторанный бизнес",
            active: true,
            usersCount: 18,
            systemPrompt:
    `Ты — помощник ресторана. Помогаешь с меню, бронированием, банкетами, поставщиками и актами.
    Всегда уточняй формат мероприятия, количество гостей, бюджет, тайминг.`,
          },
          {
            key: "construction",
            title: "Строительство",
            active: true,
            usersCount: 31,
            systemPrompt:
    `Ты — помощник строительной компании. Договора подряда, ТЗ, акты КС-2/КС-3, технадзор.
    Учитывай СНИПы, сроки, гарантию и риски.`,
          },
          {
            key: "legal",
            title: "Юридические услуги",
            active: true,
            usersCount: 12,
            systemPrompt:
    `Ты — ассистент юрфирмы. Брифуешь клиента, формируешь договор, доверенность, претензии.
    Уточняй юрисдикцию, сроки и бюджет.`,
          },
        ];

        seed.forEach((s) => {
          const id = randomUUID();
          this.industryConfigs.set(id, { id, ...s });
        });
    
    // Initialize with some system status entries
    this.initializeSystemStatus();
  }

  private initializeSystemStatus() {
    const services = [
      {
        serviceName: "Telegram Bot",
        status: "online",
        description: "Message processing",
      },
      {
        serviceName: "WhatsApp API",
        status: "online",
        description: "360Dialog integration",
      },
      {
        serviceName: "Google Sheets",
        status: "online",
        description: "Data storage",
      },
      {
        serviceName: "Payment System",
        status: "online",
        description: "QR code generation",
      },
    ];

    services.forEach((service) => {
      const status: SystemStatus = {
        id: randomUUID(),
        serviceName: service.serviceName,
        status: service.status,
        description: service.description,
        lastCheck: new Date(),
      };
      this.systemStatus.set(service.serviceName, status);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).sort(
      (a, b) =>
        new Date(b.updatedAt || 0).getTime() -
        new Date(a.updatedAt || 0).getTime(),
    );
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async createConversation(
    insertConversation: InsertConversation,
  ): Promise<Conversation> {
    const id = randomUUID();
    const now = new Date();
    const conversation: Conversation = {
      ...insertConversation,
      id,
      createdAt: now,
      updatedAt: now,
      status: insertConversation.status || "active",
      userId: insertConversation.userId || null,
      userName: insertConversation.userName || null,
      lastMessage: insertConversation.lastMessage || null,
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversation(
    id: string,
    updates: Partial<Conversation>,
  ): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;

    const updated = { ...conversation, ...updates, updatedAt: new Date() };
    this.conversations.set(id, updated);
    return updated;
  }

  async getLeads(): Promise<Lead[]> {
    return Array.from(this.leads.values()).sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );
  }

  async getLead(id: string): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = randomUUID();
    const lead: Lead = {
      ...insertLead,
      id,
      createdAt: new Date(),
      status: insertLead.status || "NEW",
      name: insertLead.name || null,
      phone: insertLead.phone || null,
      sum: insertLead.sum || null,
      items: insertLead.items || [],
    };
    this.leads.set(id, lead);
    return lead;
  }

  async updateLead(
    id: string,
    updates: Partial<Lead>,
  ): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (!lead) return undefined;

    const updated = { ...lead, ...updates };
    this.leads.set(id, updated);
    return updated;
  }

  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    return Array.from(this.products.values()).find((p) => p.sku === sku);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = randomUUID();
    const product: Product = {
      ...insertProduct,
      id,
      inStock: insertProduct.inStock ?? true,
      category: insertProduct.category || null,
      currency: insertProduct.currency || null,
      photoUrl: insertProduct.photoUrl || null,
    };
    this.products.set(id, product);
    return product;
  }

  async searchProducts(query: string): Promise<Product[]> {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.products.values()).filter(
      (product) =>
        product.name.toLowerCase().includes(lowercaseQuery) ||
        product.category?.toLowerCase().includes(lowercaseQuery) ||
        product.sku.toLowerCase().includes(lowercaseQuery),
    );
  }

  async getBotCommands(): Promise<BotCommand[]> {
    return Array.from(this.botCommands.values()).sort(
      (a, b) => (b.count || 0) - (a.count || 0),
    );
  }

  async incrementCommandUsage(command: string, channel: string): Promise<void> {
    const key = `${command}-${channel}`;
    const existing = this.botCommands.get(key);

    if (existing) {
      existing.count = (existing.count || 0) + 1;
      existing.lastUsed = new Date();
    } else {
      const newCommand: BotCommand = {
        id: randomUUID(),
        command,
        channel,
        count: 1,
        lastUsed: new Date(),
      };
      this.botCommands.set(key, newCommand);
    }
  }

  async getSystemStatus(): Promise<SystemStatus[]> {
    return Array.from(this.systemStatus.values());
  }

  async updateSystemStatus(
    serviceName: string,
    status: string,
    description?: string,
  ): Promise<void> {
    const existing = this.systemStatus.get(serviceName);
    if (existing) {
      existing.status = status;
      existing.lastCheck = new Date();
      if (description) existing.description = description;
    } else {
      const newStatus: SystemStatus = {
        id: randomUUID(),
        serviceName,
        status,
        description: description || null,
        lastCheck: new Date(),
      };
      this.systemStatus.set(serviceName, newStatus);
    }
  }
}

export const storage = new MemStorage();
