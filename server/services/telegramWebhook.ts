// server/services/telegramWebhook.ts
import { storage } from "../storage";

export interface TelegramWebhookService {
  setTenantWebhook(tenant: any): Promise<boolean>;
  deleteTenantWebhook(tenant: any): Promise<boolean>;
}

const PUBLIC_URL = process.env.PUBLIC_URL || `https://${process.env.REPL_SLUG || 'localhost'}.${process.env.REPL_OWNER || ''}.repl.co`;

/**
 * Устанавливает webhook для конкретного тенанта
 */
export async function setTenantWebhook(tenant: any): Promise<boolean> {
  try {
    if (!tenant.tgToken) {
      console.warn(`[webhook] No tgToken for tenant ${tenant.key}`);
      return false;
    }

    const webhookUrl = `${PUBLIC_URL}/webhook/tg/${tenant.key}`;
    const telegramApiUrl = `https://api.telegram.org/bot${tenant.tgToken}/setWebhook`;
    
    console.log(`[webhook] Setting webhook for tenant ${tenant.key}: ${webhookUrl}`);
    
    // Генерируем секретный токен для проверки webhook
    const secretToken = `webhook_secret_${tenant.key}_${Date.now()}`;
    
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
        secret_token: secretToken
      })
    });

    const result = await response.json() as any;
    
    if (result.ok) {
      // Обновляем tgWebhookSetAt и secretToken в базе данных
      await storage.updateTenant(tenant.id, {
        tgWebhookSetAt: new Date(),
        webhookSecret: secretToken
      } as any);
      console.log(`[webhook] Successfully set webhook for tenant ${tenant.key}`);
      return true;
    } else {
      console.error(`[webhook] Failed to set webhook for tenant ${tenant.key}:`, result.description);
      return false;
    }
  } catch (error) {
    console.error(`[webhook] Error setting webhook for tenant ${tenant.key}:`, error);
    return false;
  }
}

/**
 * Удаляет webhook для конкретного тенанта
 */
export async function deleteTenantWebhook(tenant: any): Promise<boolean> {
  try {
    if (!tenant.tgToken) {
      console.warn(`[webhook] No tgToken for tenant ${tenant.key}`);
      return false;
    }

    const telegramApiUrl = `https://api.telegram.org/bot${tenant.tgToken}/deleteWebhook`;
    
    console.log(`[webhook] Deleting webhook for tenant ${tenant.key}`);
    
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        drop_pending_updates: true
      })
    });

    const result = await response.json() as any;
    
    if (result.ok) {
      // Сбрасываем tgWebhookSetAt в базе данных
      await storage.updateTenant(tenant.id, {
        tgWebhookSetAt: null
      } as any);
      console.log(`[webhook] Successfully deleted webhook for tenant ${tenant.key}`);
      return true;
    } else {
      console.error(`[webhook] Failed to delete webhook for tenant ${tenant.key}:`, result.description);
      return false;
    }
  } catch (error) {
    console.error(`[webhook] Error deleting webhook for tenant ${tenant.key}:`, error);
    return false;
  }
}

/**
 * Получает информацию о текущем webhook для тенанта
 */
export async function getWebhookInfo(tenant: any): Promise<any> {
  try {
    if (!tenant.tgToken) {
      return null;
    }

    const telegramApiUrl = `https://api.telegram.org/bot${tenant.tgToken}/getWebhookInfo`;
    
    const response = await fetch(telegramApiUrl);
    const result = await response.json() as any;
    
    if (result.ok) {
      return result.result;
    } else {
      console.error(`[webhook] Failed to get webhook info for tenant ${tenant.key}:`, result.description);
      return null;
    }
  } catch (error) {
    console.error(`[webhook] Error getting webhook info for tenant ${tenant.key}:`, error);
    return null;
  }
}

export const telegramWebhookService = {
  setTenantWebhook,
  deleteTenantWebhook,
  getWebhookInfo,
};