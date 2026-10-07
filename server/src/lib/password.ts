import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

/**
 * scrypt: node:crypto yerlisi, native derleme gerektirmeyen bcrypt/argon2
 * alternatifi. Saklama formatı "salt:hash" (ikisi de hex).
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;

  const computed = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hashHex, "hex");
  if (computed.length !== expected.length) return false;

  // timingSafeEqual: zamanlama analiziyle hash tahmin edilmesin diye.
  return timingSafeEqual(computed, expected);
}
