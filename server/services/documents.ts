import fs from "fs";
import path from "path";
import { uploadFile } from "../integrations/google/drive";
import { storage } from "../storage";

export interface QuoteData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    price: number;
    currency: string;
  }>;
  deliveryAddress?: string;
  notes?: string;
  validUntil?: Date;
}

export interface InvoiceData {
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    price: number;
    currency: string;
  }>;
  deliveryAddress?: string;
  paymentMethod?: string;
  dueDate?: Date;
}

export class DocumentService {
  private tempDir = path.join(process.cwd(), "temp");

  constructor() {
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async generateQuote(
    tenantId: string,
    leadId: string,
    data: QuoteData
  ): Promise<string | null> {
    try {
      const tenant = await storage.getTenantById(tenantId);
      if (!tenant) {
        console.error(`Tenant ${tenantId} not found`);
        return null;
      }

      // Generate HTML content for the quote
      const htmlContent = this.generateQuoteHTML(data, tenant);
      
      // Save as HTML file temporarily
      const fileName = `quote_${leadId}_${Date.now()}.html`;
      const filePath = path.join(this.tempDir, fileName);
      fs.writeFileSync(filePath, htmlContent, 'utf8');

      // Upload to Google Drive
      const driveUrl = await uploadFile(
        `Коммерческое предложение ${data.customerName}`,
        filePath,
        tenant.gdriveFolderId,
        "text/html"
      );

      // Clean up temp file
      fs.unlinkSync(filePath);

      return driveUrl;
    } catch (error) {
      console.error("Quote generation error:", error);
      return null;
    }
  }

  async generateInvoice(
    tenantId: string,
    orderId: string,
    data: InvoiceData
  ): Promise<string | null> {
    try {
      const tenant = await storage.getTenantById(tenantId);
      if (!tenant) {
        console.error(`Tenant ${tenantId} not found`);
        return null;
      }

      // Generate HTML content for the invoice
      const htmlContent = this.generateInvoiceHTML(data, tenant);
      
      // Save as HTML file temporarily
      const fileName = `invoice_${orderId}_${Date.now()}.html`;
      const filePath = path.join(this.tempDir, fileName);
      fs.writeFileSync(filePath, htmlContent, 'utf8');

      // Upload to Google Drive
      const driveUrl = await uploadFile(
        `Счет ${data.orderNumber}`,
        filePath,
        tenant.gdriveFolderId,
        "text/html"
      );

      // Clean up temp file
      fs.unlinkSync(filePath);

      return driveUrl;
    } catch (error) {
      console.error("Invoice generation error:", error);
      return null;
    }
  }

  private generateQuoteHTML(data: QuoteData, tenant: any): string {
    const subtotal = data.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const currency = data.items[0]?.currency || "KZT";

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Коммерческое предложение</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .company-name { font-size: 24px; font-weight: bold; color: #333; }
        .document-title { font-size: 20px; margin: 20px 0; }
        .customer-info { margin: 20px 0; }
        .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .items-table th { background-color: #f2f2f2; }
        .total { text-align: right; margin: 20px 0; font-size: 18px; font-weight: bold; }
        .footer { margin-top: 40px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">${tenant.title || "Компания"}</div>
        <div class="document-title">КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</div>
        <div>от ${new Date().toLocaleDateString('ru-RU')}</div>
    </div>

    <div class="customer-info">
        <strong>Клиент:</strong> ${data.customerName}<br>
        ${data.customerEmail ? `<strong>Email:</strong> ${data.customerEmail}<br>` : ''}
        ${data.customerPhone ? `<strong>Телефон:</strong> ${data.customerPhone}<br>` : ''}
        ${data.deliveryAddress ? `<strong>Адрес доставки:</strong> ${data.deliveryAddress}<br>` : ''}
    </div>

    <table class="items-table">
        <thead>
            <tr>
                <th>№</th>
                <th>Наименование</th>
                <th>Артикул</th>
                <th>Количество</th>
                <th>Цена</th>
                <th>Сумма</th>
            </tr>
        </thead>
        <tbody>
            ${data.items.map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.name}</td>
                    <td>${item.sku}</td>
                    <td>${item.quantity}</td>
                    <td>${item.price.toFixed(2)} ${item.currency}</td>
                    <td>${(item.price * item.quantity).toFixed(2)} ${item.currency}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="total">
        Итого: ${subtotal.toFixed(2)} ${currency}
    </div>

    ${data.notes ? `<div><strong>Примечания:</strong> ${data.notes}</div>` : ''}
    ${data.validUntil ? `<div><strong>Предложение действительно до:</strong> ${data.validUntil.toLocaleDateString('ru-RU')}</div>` : ''}

    <div class="footer">
        Документ сгенерирован автоматически ${new Date().toLocaleString('ru-RU')}
    </div>
</body>
</html>`;
  }

  private generateInvoiceHTML(data: InvoiceData, tenant: any): string {
    const subtotal = data.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const currency = data.items[0]?.currency || "KZT";

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Счет на оплату</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .company-name { font-size: 24px; font-weight: bold; color: #333; }
        .document-title { font-size: 20px; margin: 20px 0; }
        .customer-info { margin: 20px 0; }
        .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .items-table th { background-color: #f2f2f2; }
        .total { text-align: right; margin: 20px 0; font-size: 18px; font-weight: bold; }
        .footer { margin-top: 40px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">${tenant.title || "Компания"}</div>
        <div class="document-title">СЧЕТ НА ОПЛАТУ № ${data.orderNumber}</div>
        <div>от ${new Date().toLocaleDateString('ru-RU')}</div>
    </div>

    <div class="customer-info">
        <strong>Плательщик:</strong> ${data.customerName}<br>
        ${data.customerEmail ? `<strong>Email:</strong> ${data.customerEmail}<br>` : ''}
        ${data.customerPhone ? `<strong>Телефон:</strong> ${data.customerPhone}<br>` : ''}
        ${data.deliveryAddress ? `<strong>Адрес доставки:</strong> ${data.deliveryAddress}<br>` : ''}
        ${data.paymentMethod ? `<strong>Способ оплаты:</strong> ${data.paymentMethod}<br>` : ''}
        ${data.dueDate ? `<strong>Срок оплаты:</strong> ${data.dueDate.toLocaleDateString('ru-RU')}<br>` : ''}
    </div>

    <table class="items-table">
        <thead>
            <tr>
                <th>№</th>
                <th>Наименование</th>
                <th>Артикул</th>
                <th>Количество</th>
                <th>Цена</th>
                <th>Сумма</th>
            </tr>
        </thead>
        <tbody>
            ${data.items.map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.name}</td>
                    <td>${item.sku}</td>
                    <td>${item.quantity}</td>
                    <td>${item.price.toFixed(2)} ${item.currency}</td>
                    <td>${(item.price * item.quantity).toFixed(2)} ${item.currency}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="total">
        К оплате: ${subtotal.toFixed(2)} ${currency}
    </div>

    <div class="footer">
        Счет сгенерирован автоматически ${new Date().toLocaleString('ru-RU')}
    </div>
</body>
</html>`;
  }
}

export const documentService = new DocumentService();