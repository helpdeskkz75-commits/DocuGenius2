import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  category: text("category"),
  price: integer("price").notNull(),
  currency: text("currency").default("KZT"),
  photoUrl: text("photo_url"),
  inStock: boolean("in_stock").default(true),
});

export const botCommands = pgTable("bot_commands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  command: text("command").notNull(),
  channel: text("channel").notNull(),
  count: integer("count").default(1),
  lastUsed: timestamp("last_used").defaultNow(),
});

export const systemStatus = pgTable("system_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
