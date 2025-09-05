import { apiRequest } from './queryClient';

export interface DashboardStats {
  activeConversations: number;
  newLeads: number;
  ordersToday: number;
  responseRate: number;
}

export interface Conversation {
  id: string;
  chatId: string;
  channel: string;
  userId?: string;
  userName?: string;
  lastMessage?: string;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Lead {
  id: string;
  leadId: string;
  channel: string;
  name?: string;
  phone?: string;
  items: any[];
  sum: number;
  status: string;
  createdAt?: Date;
}

export interface BotCommand {
  id: string;
  command: string;
  channel: string;
  count: number;
  lastUsed?: Date;
}

export interface SystemStatus {
  id: string;
  serviceName: string;
  status: string;
  description?: string;
  lastCheck?: Date;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  price: number;
  currency: string;
  photoUrl?: string;
  inStock: boolean;
}

export const api = {
  getDashboardStats: (): Promise<DashboardStats> =>
    apiRequest('GET', '/api/dashboard/stats').then(res => res.json()),
  
  getConversations: (): Promise<Conversation[]> =>
    apiRequest('GET', '/api/conversations').then(res => res.json()),
  
  getLeads: (): Promise<Lead[]> =>
    apiRequest('GET', '/api/leads').then(res => res.json()),
  
  getCommands: (): Promise<BotCommand[]> =>
    apiRequest('GET', '/api/commands').then(res => res.json()),
  
  getSystemStatus: (): Promise<SystemStatus[]> =>
    apiRequest('GET', '/api/system-status').then(res => res.json()),
  
  getProducts: (): Promise<Product[]> =>
    apiRequest('GET', '/api/products').then(res => res.json()),
  
  searchProducts: (query: string): Promise<Product[]> =>
    apiRequest('GET', `/api/products/search?q=${encodeURIComponent(query)}`).then(res => res.json()),
  
  createLead: (data: { channel: string; name: string; phone: string; items: any[]; sum: number }) =>
    apiRequest('POST', '/api/leads', data)
};
