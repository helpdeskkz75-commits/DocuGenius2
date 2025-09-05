import { WAClient } from './base';

export class WA360Client implements WAClient {
  private url: string;
  private key: string;
  private phoneId: string;

  constructor() {
    this.url = (process.env.WA_API_URL || '').replace(/\/$/, '');
    this.key = process.env.WA_API_KEY || '';
    this.phoneId = process.env.WA_PHONE_NUMBER_ID || '';
    if (!this.url || !this.key) {
      throw new Error('WA_API_URL/WA_API_KEY not set');
    }
  }

  async sendText(to: string, text: string) {
    const resp = await fetch(`${this.url}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'D360-API-KEY': this.key },
      body: JSON.stringify({ to, type: 'text', text: { body: text } })
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`WA send failed: ${resp.status} ${t}`);
    }
  }
}
