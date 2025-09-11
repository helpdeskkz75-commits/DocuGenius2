import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  jsonb,
  boolean,
  serial,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Multi-tenant Core Tables
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),            // url-safe tenant key
  title: text("title").notNull(),
  tgToken: text("tg_token"),
  waPhoneId: text("wa_phone_id"),
  waApiKey: text("wa_api_key"),
  gdriveFolderId: text("gdrive_folder_id"),
  locale: text("locale").default("ru"),
  currency: text("currency").default("KZT"),
  pricePolicy: text("price_policy").default("retail"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const catalogs = pgTable("catalogs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  brand: text("brand"),
  category: text("category"),
  unit: text("unit").default("шт"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  stock: integer("stock").default(0),
  packQty: integer("pack_qty").default(1),
  warehouse: text("warehouse"),
  leadTimeDays: integer("lead_time_days").default(0),
  photoUrl: text("photo_url"),
  description: text("description"),
  attrs: jsonb("attrs"),
  searchable: text("searchable") // tsvector через миграцию
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  chatId: text("chat_id").notNull(),
  channel: text("channel").notNull(), // "tg" | "wa"
  phone: text("phone"),
  name: text("name"),
  type: text("type").default("b2c"),   // b2b|b2c
  bin: text("bin"),
  email: text("email"),
});

export const carts = pgTable("carts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  customerId: integer("customer_id").references(() => customers.id),
  status: text("status").default("open"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  cartId: integer("cart_id").notNull().references(() => carts.id),
  sku: text("sku").notNull(),
  qty: integer("qty").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  customerId: integer("customer_id").references(() => customers.id),
  total: numeric("total", { precision: 12, scale: 2 }).default("0"),
  status: text("status").default("draft"),
  delivery: text("delivery"),
  payment: text("payment"),
  meta: jsonb("meta")
});

export const tenantLeads = pgTable("tenant_leads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  needByDate: date("need_by_date"),
  comment: text("comment"),
  fileUrl: text("file_url"),
});

export const texts = pgTable("texts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  key: text("key").notNull(),
  value: text("value").notNull(),
});

// Legacy System Tables
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  chatId: text("chat_id").notNull(),
  channel: text("channel").notNull(), // 'telegram' | 'whatsapp'
  userId: text("user_id"),
  userName: text("user_name"),
  lastMessage: text("last_message"),
  status: text("status").notNull().default("active"), // 'active' | 'pending' | 'closed'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leads = pgTable("leads", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  leadId: text("lead_id").notNull().unique(),
  channel: text("channel").notNull(),
  name: text("name"),
  phone: text("phone"),
  items: jsonb("items").default([]),
  sum: integer("sum").default(0),
  status: text("status").notNull().default("NEW"), // 'NEW' | 'PAID' | 'CANCELLED'
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  category: text("category"),
  price: integer("price").notNull(),
  currency: text("currency").default("KZT"),
  photoUrl: text("photo_url"),
  inStock: boolean("in_stock").default(true),
});

export const botCommands = pgTable("bot_commands", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  command: text("command").notNull(),
  channel: text("channel").notNull(),
  count: integer("count").default(1),
  lastUsed: timestamp("last_used").defaultNow(),
});

export const systemStatus = pgTable("system_status", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  serviceName: text("service_name").notNull().unique(),
  status: text("status").notNull(), // 'online' | 'offline' | 'error'
  lastCheck: timestamp("last_check").defaultNow(),
  description: text("description"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});

export const insertBotCommandSchema = createInsertSchema(botCommands).omit({
  id: true,
  lastUsed: true,
});

export const insertSystemStatusSchema = createInsertSchema(systemStatus).omit({
  id: true,
  lastCheck: true,
});

// Multi-tenant Zod Schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
});

export const insertCatalogSchema = createInsertSchema(catalogs).omit({
  id: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
});

export const insertCartSchema = createInsertSchema(carts).omit({
  id: true,
  createdAt: true,
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
});

export const insertTenantLeadSchema = createInsertSchema(tenantLeads).omit({
  id: true,
});

export const insertTextSchema = createInsertSchema(texts).omit({
  id: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type BotCommand = typeof botCommands.$inferSelect;
export type InsertBotCommand = z.infer<typeof insertBotCommandSchema>;
export type SystemStatus = typeof systemStatus.$inferSelect;
export type InsertSystemStatus = z.infer<typeof insertSystemStatusSchema>;

// Multi-tenant types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Catalog = typeof catalogs.$inferSelect;
export type InsertCatalog = z.infer<typeof insertCatalogSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Cart = typeof carts.$inferSelect;
export type InsertCart = z.infer<typeof insertCartSchema>;
export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type TenantLead = typeof tenantLeads.$inferSelect;
export type InsertTenantLead = z.infer<typeof insertTenantLeadSchema>;
export type TextContent = typeof texts.$inferSelect;
export type InsertTextContent = z.infer<typeof insertTextSchema>;

// --- AI Industry Configs ---
export const industryKeys = [
  "dentistry",
  "restaurant",
  "construction",
  "legal",
] as const;

export type IndustryKey = (typeof industryKeys)[number];

export interface IndustryConfig {
  id: string;
  key: IndustryKey; // системный ключ
  title: string; // Человекочитаемое название (Стоматология и т.п.)
  active: boolean; // Активна/выключена
  usersCount: number; // Кол-во пользователей (метрика в карточке)
  systemPrompt: string; // Системный промпт для этой отрасли
}

export type InsertIndustryConfig = Omit<IndustryConfig, "id">;
