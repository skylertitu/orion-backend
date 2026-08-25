import crypto from 'crypto';
import { logger } from './logger';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const dedicated = (process.env.ENCRYPTION_KEY || '').trim();
  if (dedicated) {
    return crypto.createHash('sha256').update(dedicated).digest();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY es obligatorio en producción');
  }
  const fallback = (process.env.JWT_SECRET || '').trim();
  if (!fallback) {
    throw new Error('ENCRYPTION_KEY es requerido para cifrar credenciales');
  }
  logger.warn('[crypto] ENCRYPTION_KEY no está definido; se usa JWT_SECRET solo en desarrollo');
  return crypto.createHash('sha256').update(fallback).digest();
}

export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string): string {
  if (!payload) return '';
  const key = getEncryptionKey();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function isEncryptedPayload(value: string): boolean {
  if (!value) return false;
  try {
    const buf = Buffer.from(value, 'base64');
    return buf.length > IV_LENGTH + TAG_LENGTH;
  } catch {
    return false;
  }
}
