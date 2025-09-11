import { storage } from "../storage";
import { getRows, searchProducts } from "../integrations/google/sheets";

export interface CatalogItem {
  sku: string;
  name: string;
  price: number;
  currency: string;
  category?: string;
  photoURL?: string;
  description?: string;
}

export class CatalogService {
  async searchProducts(
    tenantId: string,
    query: string,
    limit: number = 20
  ): Promise<CatalogItem[]> {
    try {
      // Get tenant configuration for sheets
      const tenant = await storage.getTenantById(tenantId);
      if (!tenant?.pricesSheetId) {
        console.warn(`No pricesSheetId configured for tenant ${tenantId}`);
        return [];
      }

      const range = tenant.pricesRange || "Catalog!A:Z";
      
      // Use existing Google Sheets search functionality
      const results = await searchProducts(tenant.pricesSheetId, range, query);
      
      // Convert to standardized format
      return results.slice(0, limit).map(this.normalizeProduct);
    } catch (error) {
      console.error("Catalog search error:", error);
      return [];
    }
  }

  async getProductBySku(
    tenantId: string,
    sku: string
  ): Promise<CatalogItem | null> {
    try {
      const tenant = await storage.getTenantById(tenantId);
      if (!tenant?.pricesSheetId) {
        return null;
      }

      const range = tenant.pricesRange || "Catalog!A:Z";
      const rows = await getRows(tenant.pricesSheetId, range);
      
      if (!rows.length) return null;
      
      const header = rows[0].map((x: string) => String(x).trim());
      const skuIndex = header.findIndex(h => 
        h.toLowerCase().includes('sku') || h.toLowerCase().includes('артикул')
      );
      
      if (skuIndex === -1) return null;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (String(row[skuIndex] || "").trim().toLowerCase() === sku.toLowerCase()) {
          return this.rowToProduct(row, header);
        }
      }
      
      return null;
    } catch (error) {
      console.error("Get product by SKU error:", error);
      return null;
    }
  }

  async getAllProducts(tenantId: string): Promise<CatalogItem[]> {
    try {
      const tenant = await storage.getTenantById(tenantId);
      if (!tenant?.pricesSheetId) {
        return [];
      }

      const range = tenant.pricesRange || "Catalog!A:Z";
      const rows = await getRows(tenant.pricesSheetId, range);
      
      if (!rows.length) return [];
      
      const header = rows[0].map((x: string) => String(x).trim());
      const products: CatalogItem[] = [];
      
      for (let i = 1; i < rows.length; i++) {
        const product = this.rowToProduct(rows[i], header);
        if (product) {
          products.push(product);
        }
      }
      
      return products;
    } catch (error) {
      console.error("Get all products error:", error);
      return [];
    }
  }

  private rowToProduct(row: any[], header: string[]): CatalogItem | null {
    const indices = {
      sku: this.findHeaderIndex(header, ['sku', 'артикул', 'код']),
      name: this.findHeaderIndex(header, ['name', 'название', 'наименование', 'title']),
      price: this.findHeaderIndex(header, ['price', 'цена', 'стоимость', 'cost']),
      currency: this.findHeaderIndex(header, ['currency', 'валюта']),
      category: this.findHeaderIndex(header, ['category', 'категория']),
      photoURL: this.findHeaderIndex(header, ['photo', 'фото', 'image', 'картинка']),
      description: this.findHeaderIndex(header, ['description', 'описание', 'desc'])
    };

    const sku = row[indices.sku];
    const name = row[indices.name];
    const priceRaw = row[indices.price];
    
    if (!sku || !name || !priceRaw) return null;
    
    const price = Number(priceRaw);
    if (!isFinite(price)) return null;

    return {
      sku: String(sku).trim(),
      name: String(name).trim(),
      price,
      currency: row[indices.currency] || "KZT",
      category: row[indices.category] || undefined,
      photoURL: row[indices.photoURL] || undefined,
      description: row[indices.description] || undefined,
    };
  }

  private findHeaderIndex(header: string[], variants: string[]): number {
    for (const variant of variants) {
      const index = header.findIndex(h => 
        h.toLowerCase().includes(variant.toLowerCase())
      );
      if (index !== -1) return index;
    }
    return -1;
  }

  private normalizeProduct(rawProduct: any): CatalogItem {
    return {
      sku: rawProduct.sku || rawProduct.SKU || "",
      name: rawProduct.name || rawProduct.Name || "",
      price: Number(rawProduct.price || rawProduct.Price || 0),
      currency: rawProduct.currency || rawProduct.Currency || "KZT",
      category: rawProduct.category || rawProduct.Category,
      photoURL: rawProduct.photoURL || rawProduct.PhotoURL,
      description: rawProduct.description || rawProduct.Description,
    };
  }
}

export const catalogService = new CatalogService();