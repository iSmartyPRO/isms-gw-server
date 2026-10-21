import crypto from 'node:crypto';

/*
 * Connection tokens of phones: `smsgw_<8>_<32>` (base62). Only a SHA-256 is
 * stored; the prefix `smsgw_<8>` is kept to recognise a token in the UI.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomText(length) {
  const bytes = crypto.randomBytes(length * 2);
  let out = '';
  for (let index = 0; out.length < length && index < bytes.length; index += 1) {
    // 248 = 4 × 62: values above it are dropped so every character is equally likely.
    if (bytes[index] < 248) out += ALPHABET[bytes[index] % 62];
  }
  return out.length === length ? out : randomText(length);
}

export const TOKEN_PATTERN = /^smsgw_[A-Za-z0-9]{8}_[A-Za-z0-9]{32}$/;

export function newDeviceToken() {
  const prefix = `smsgw_${randomText(8)}`;
  const token = `${prefix}_${randomText(32)}`;
  return { token, prefix, hash: hashToken(token) };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/** The bearer token of an upgrade request (`Authorization: Bearer …`). */
export function bearerOf(header) {
  const match = /^Bearer\s+(\S+)$/i.exec(String(header || '').trim());
  return match && TOKEN_PATTERN.test(match[1]) ? match[1] : null;
}
