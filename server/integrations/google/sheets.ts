import { google } from 'googleapis';

function getSheetsClient() {
  const credentialsB64 = process.env.GOOGLE_CREDENTIALS_JSON_BASE64;
  if (!credentialsB64) throw new Error('GOOGLE_CREDENTIALS_JSON_BASE64 not set');
  const json = JSON.parse(Buffer.from(credentialsB64, 'base64').toString('utf-8'));
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  const auth = new google.auth.GoogleAuth({ credentials: json, scopes });
  return google.sheets({ version: 'v4', auth });
}

export async function getRows(spreadsheetId: string, range: string) {
  const sheets = getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return resp.data.values || [];
}

export async function appendRow(spreadsheetId: string, range: string, values: any[]) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId, range, valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] }
  });
}

export async function getPriceBySku(spreadsheetId: string, range: string, sku: string) {
  const rows = await getRows(spreadsheetId, range);
  if (!rows.length) return null;
  const header = rows[0].map((x: string) => String(x).trim());
  const idx = {
    SKU: header.indexOf('SKU'),
    Name: header.indexOf('Name'),
    Category: header.indexOf('Category'),
    Price: header.indexOf('Price'),
    Currency: header.indexOf('Currency'),
    PhotoURL: header.indexOf('PhotoURL'),
  };
  for (let i=1; i<rows.length; i++) {
    const r = rows[i];
    if (String(r[idx.SKU] || '').trim().toLowerCase() === sku.trim().toLowerCase()) {
      return {
        SKU: r[idx.SKU], Name: r[idx.Name], Category: r[idx.Category],
        Price: r[idx.Price], Currency: r[idx.Currency], PhotoURL: r[idx.PhotoURL]
      };
    }
  }
  return null;
}

export async function searchProducts(spreadsheetId: string, range: string, query: string) {
  const rows = await getRows(spreadsheetId, range);
  if (!rows.length) return [];
  const header = rows[0].map((x: string) => String(x).trim());
  const idx = {
    SKU: header.indexOf('SKU'),
    Name: header.indexOf('Name'),
    Category: header.indexOf('Category'),
    Price: header.indexOf('Price'),
    Currency: header.indexOf('Currency'),
    PhotoURL: header.indexOf('PhotoURL'),
  };
  const q = query.trim().toLowerCase();
  const out: any[] = [];
  for (let i=1; i<rows.length; i++) {
    const r = rows[i];
    const name = String(r[idx.Name] || '').toLowerCase();
    const cat = String(r[idx.Category] || '').toLowerCase();
    if (name.includes(q) || cat.includes(q)) {
      out.push({
        SKU: r[idx.SKU], Name: r[idx.Name], Category: r[idx.Category],
        Price: r[idx.Price], Currency: r[idx.Currency], PhotoURL: r[idx.PhotoURL]
      });
    }
    if (out.length >= 10) break;
  }
  return out;
}
