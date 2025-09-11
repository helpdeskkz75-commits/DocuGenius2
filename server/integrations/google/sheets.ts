import { google } from "googleapis";

function getSheetsClient() {
  const credentialsB64 = process.env.GOOGLE_CREDENTIALS_JSON_BASE64;
  if (!credentialsB64) {
    console.log(
      "GOOGLE_CREDENTIALS_JSON_BASE64 not set, Google Sheets integration disabled",
    );
    return null;
  }
  const json = JSON.parse(
    Buffer.from(credentialsB64, "base64").toString("utf-8"),
  );
  const scopes = ["https://www.googleapis.com/auth/spreadsheets"];
  const auth = new google.auth.GoogleAuth({ credentials: json, scopes });
  return google.sheets({ version: "v4", auth });
}

export async function getRows(spreadsheetId: string, range: string) {
  const sheets = getSheetsClient();
  if (!sheets || !spreadsheetId) return [];
  try {
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return resp.data.values || [];
  } catch (error) {
    console.error("Error fetching Google Sheets data:", error);
    return [];
  }
}

export async function appendRow(
  spreadsheetId: string,
  range: string,
  values: any[],
) {
  const sheets = getSheetsClient();
  if (!sheets || !spreadsheetId) return;
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    });
  } catch (error) {
    console.error("Error appending to Google Sheets:", error);
  }
}

export async function getPriceBySku(
  spreadsheetId: string,
  range: string,
  sku: string,
) {
  if (!spreadsheetId) return null;
  const rows = await getRows(spreadsheetId, range);
  if (!rows.length) return null;
  const header = rows[0].map((x: string) => String(x).trim());
  const idx = {
    SKU: header.indexOf("SKU"),
    Name: header.indexOf("Name"),
    Category: header.indexOf("Category"),
    Price: header.indexOf("Price"),
    Currency: header.indexOf("Currency"),
    PhotoURL: header.indexOf("PhotoURL"),
  };
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (
      String(r[idx.SKU] || "")
        .trim()
        .toLowerCase() === sku.trim().toLowerCase()
    ) {
      return {
        SKU: r[idx.SKU],
        Name: r[idx.Name],
        Category: r[idx.Category],
        Price: r[idx.Price],
        Currency: r[idx.Currency],
        PhotoURL: r[idx.PhotoURL],
      };
    }
  }
  return null;
}

export async function searchProducts(
  sheetId: string,
  range: string,
  query: string,
) {
  const rows = await getRows(sheetId, range);
  if (!rows || !rows.length) return [];

  const headers = rows[0].map((h: any) => String(h || "").trim());
  const H = (name: string) =>
    headers.findIndex((h: string) => h.toLowerCase() === name.toLowerCase());

  const idxSKU = H("SKU");
  const idxName = H("Name");
  const idxCat = H("Category");
  const idxPrice = H("Price");
  const idxCur = H("Currency");
  const idxPhoto = H("PhotoURL");

  const data = rows.slice(1);

  function norm(s: any): string {
    return String(s || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^a-z0-9а-я]+/g, " ")
      .replace(/мм/g, "mm") // унифицируем мм → mm
      .replace(/\s+/g, " ")
      .trim();
  }

  const q = norm(query);
  if (!q) return [];

  const qTokens = Array.from(new Set(q.split(" ").filter(Boolean)));

  // --- НОВОЕ: извлекаем "товарные подсказки" из запроса ---
  const hintMap: Record<string, RegExp[]> = {
    // ключ → набор паттернов, которые должны встречаться в товаре
    армат: [/армат/], // арматура
    цемент: [/цемент/],
    гипсок: [/гипсокарт|гкл|gkl|гипсо/],
    клей: [/клей/],
    пена: [/пена/],
    профил: [/профил/],
    саморез: [/саморез/],
  };
  const productHints: RegExp[] = [];
  for (const t of qTokens) {
    if (t.startsWith("армат")) productHints.push(...hintMap["армат"]);
    if (t.startsWith("цемент")) productHints.push(...hintMap["цемент"]);
    if (t.startsWith("гипсок")) productHints.push(...hintMap["гипсок"]);
    if (t.startsWith("гкл") || t === "gkl")
      productHints.push(...hintMap["гипсок"]);
    if (t.startsWith("клей")) productHints.push(...hintMap["клей"]);
    if (t.startsWith("пена")) productHints.push(...hintMap["пена"]);
    if (t.startsWith("профил")) productHints.push(...hintMap["профил"]);
    if (t.startsWith("саморез")) productHints.push(...hintMap["саморез"]);
  }
  const hasProductHints = productHints.length > 0;

  function scoreRow(row: any[]): number {
    const sku = row[idxSKU] || "";
    const name = row[idxName] || "";
    const cat = row[idxCat] || "";
    const hay = norm(`${sku} ${name} ${cat}`);

    let score = 0;

    // Базовый скоринг по токенам
    for (const t of qTokens) {
      if (!t) continue;
      if (hay.includes(t)) score += 3;

      // числа → d12 / 12mm
      if (/^\d+$/.test(t)) {
        if (hay.includes(`d${t}`)) score += 3; // важнее для арматуры
        if (hay.includes(`${t}mm`)) score += 2;
      }
      // «12мм» → 12mm
      if (/^\d+мм$/.test(t)) {
        const base = t.replace("мм", "mm");
        if (hay.includes(base)) score += 2;
      }
      // частичный матч "арм" как индикатор арматуры
      if (t.length >= 3 && /арм/.test(t) && /армат/.test(hay)) score += 3;
    }

    // --- НОВОЕ: усиление/штраф по контексту товара ---
    if (hasProductHints) {
      const matchesHint = productHints.some((re) => re.test(hay));
      if (matchesHint) {
        score += 10; // сильно продвигаем нужный тип товара
      } else {
        score -= 6; // и штрафуем нерелевантный (отсекаем гипсокартон при запросе "арматура 12мм")
      }
    }

    return score;
  }

  function buildResults(tokens: string[]) {
    return data
      .map((row: any[]) => ({ row, score: scoreRow(row) }))
      .filter((x: any) => x.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 10)
      .map(({ row }: any) => ({
        SKU: row[idxSKU],
        Name: row[idxName],
        Category: row[idxCat],
        Price: row[idxPrice],
        Currency: row[idxCur],
        PhotoURL: row[idxPhoto],
      }));
  }

  // Первая попытка — все токены
  let results = buildResults(qTokens);
  if (results.length) return results;

  // Fallback — по самому "сильному" токену
  const strong = qTokens
    .filter((t) => t.length >= 3)
    .sort((a, b) => b.length - a.length);
  for (const t of strong) {
    results = buildResults([t]);
    if (results.length) return results;
  }

  return [];
}
