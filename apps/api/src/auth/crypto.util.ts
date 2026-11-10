import { createHash, randomBytes } from 'node:crypto';

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string, secret: string): string {
  return createHash('sha256').update(`${secret}:${token}`, 'utf8').digest('hex');
}
