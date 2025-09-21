// Polyfill for crypto module in Node.js 18 with TypeORM
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}