// server/services/cart.ts
export interface CartItem {
  SKU: string;
  Name: string;
  Price: number;
  Currency?: string;
  qty: number;
}

class CartService {
  private carts = new Map<number, Map<string, CartItem>>(); // chatId -> SKU -> item

  private cart(chatId: number) {
    let c = this.carts.get(chatId);
    if (!c) {
      c = new Map();
      this.carts.set(chatId, c);
    }
    return c;
  }

  add(chatId: number, item: Omit<CartItem, "qty">, qty: number) {
    const c = this.cart(chatId);
    const cur = c.get(item.SKU);
    const nextQty = Math.max(1, Math.round(qty || 1));
    if (cur) {
      cur.qty += nextQty;
      c.set(item.SKU, cur);
      return cur;
    }
    const rec: CartItem = { ...item, qty: nextQty };
    c.set(item.SKU, rec);
    return rec;
  }

  remove(chatId: number, sku: string) {
    const c = this.cart(chatId);
    c.delete(sku);
  }

  clear(chatId: number) {
    this.carts.delete(chatId);
  }

  items(chatId: number): CartItem[] {
    const c = this.carts.get(chatId);
    return c ? Array.from(c.values()) : [];
  }

  isEmpty(chatId: number) {
    return this.items(chatId).length === 0;
  }

  totals(chatId: number, vatRate: number, pricesIncludeVat: boolean) {
    const items = this.items(chatId);
    const subtotal = items.reduce(
      (s, it) => s + (Number(it.Price) || 0) * it.qty,
      0,
    );
    const vat = pricesIncludeVat
      ? subtotal - subtotal / (1 + vatRate)
      : subtotal * vatRate;
    const total = pricesIncludeVat ? subtotal : subtotal + vat;
    const currency = items[0]?.Currency || "";
    return { items, subtotal, vat, total, currency, vatRate, pricesIncludeVat };
  }
}

export const cartService = new CartService();
