import crypto from 'node:crypto';
import { appConfig } from '../config';

export interface SealedValue {
  iv: string;
  tag: string;
  value: string;
}

const key = crypto.createHash('sha256').update(appConfig.personalDataKey).digest();

export function seal(plain: string): SealedValue {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const value = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    value: value.toString('base64'),
  };
}

export function open(sealed: SealedValue): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(sealed.value, 'base64')), decipher.final()]).toString('utf8');
}

export function normalizeDocument(docNumber: string): string {
  return docNumber.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export function hashDocument(docType: string, docNumber: string): string {
  return crypto
    .createHash('sha256')
    .update(`${docType}:${normalizeDocument(docNumber)}`)
    .digest('hex');
}

export function lastFour(docNumber: string): string {
  const normalized = normalizeDocument(docNumber);
  return normalized.slice(-4);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(10).toString('hex')}`;
}

export function hashPasswordSync(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `s1$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 's1') return false;
  const [, salt, expected] = parts;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expected, 'hex');
    return derived.length === expectedBuffer.length && crypto.timingSafeEqual(derived, expectedBuffer);
  } catch {
    return false;
  }
}
