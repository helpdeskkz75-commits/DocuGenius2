import { WAClient } from './base.js';

export function getWAClient(): WAClient {
  const prov = (process.env.WA_PROVIDER || '360dialog').toLowerCase();
  switch (prov) {
    case '360dialog': {
      // Dynamic import to avoid module loading issues
      const { WA360Client } = require('./wa360dialog.js');
      return new WA360Client();
    }
    default: throw new Error('Unknown WA provider: ' + prov);
  }
}
