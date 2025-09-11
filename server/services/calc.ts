export function parseNumber(v: any): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const s = String(v)
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function calcTotals(
  priceRaw: any,
  qtyRaw: any,
  opts?: {
    vatPercent?: number;
    pricesIncludeVat?: boolean;
  },
) {
  const price = parseNumber(priceRaw);
  const qty = Math.max(1, parseInt(String(qtyRaw), 10) || 1);
  const vatPercent =
    (opts?.vatPercent ?? Number(process.env.VAT_PERCENT ?? 12)) / 100;
  const includeVAT =
    String(
      opts?.pricesIncludeVat ?? process.env.PRICES_INCLUDE_VAT ?? "false",
    ).toLowerCase() === "true";
  if (includeVAT) {
    const total = price * qty;
    const net = total / (1 + vatPercent);
    const vat = total - net;
    return {
      qty,
      price,
      net,
      vat,
      total,
      pricesIncludeVat: true,
      vatRate: vatPercent,
    };
  } else {
    const net = price * qty;
    const vat = net * vatPercent;
    const total = net + vat;
    return {
      qty,
      price,
      net,
      vat,
      total,
      pricesIncludeVat: false,
      vatRate: vatPercent,
    };
  }
}

export function fmtMoney(n: number, currency?: string) {
  const symbol = process.env.CURRENCY_SYMBOL || "";
  const cur = currency || process.env.DEFAULT_CURRENCY || "";
  const s = Number(n).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  return symbol ? `${s} ${cur || symbol}` : `${s} ${cur}`.trim();
}
