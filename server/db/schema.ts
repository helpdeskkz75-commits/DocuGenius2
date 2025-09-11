// server/db/schema.ts
import { pgTable, serial, text, integer, numeric, timestamp, jsonb, date } from "drizzle-orm/pg-core";

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

export const leads = pgTable("leads", {
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