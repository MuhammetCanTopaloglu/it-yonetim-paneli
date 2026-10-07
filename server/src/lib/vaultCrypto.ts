import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";

/**
 * Kasa kripto çekirdeği — SAF fonksiyonlar, DB/HTTP'den tamamen bağımsız
 * (birim testlerle doğrulanabilir, route'lar sadece bunu çağırır).
 *
 * KDF: scrypt (node:crypto yerlisi, native derleme yok — better-sqlite3
 * dersini tekrarlamıyoruz). Login hash'inden (lib/password.ts) DAHA GÜÇLÜ
 * parametreler kullanılıyor: kasa anahtarı seyrek türetiliyor (açılışta bir
 * kez), bu yüzden yavaş olması sorun değil, kaba kuvvete direnci artırıyor.
 *
 * Şifreleme: AES-256-GCM — kimlik doğrulamalı (AEAD): hem gizlilik hem
 * BÜTÜNLÜK. Yanlış anahtar veya bozulmuş veri sessizce çöp döndürmez,
 * auth tag kontrolü kriptografik olarak garanti başarısız olur (throw).
 *
 * IV KURALI (kritik): GCM'de aynı anahtar+IV ikilisini iki kez kullanmak
 * güvenliği tamamen kırar. Bu yüzden `encrypt()` HER ÇAĞRIDA taze
 * `randomBytes(12)` üretir — IV asla sabitlenmez/türetilmez.
 */

export interface KdfParams {
  N: number;
  r: number;
  p: number;
}

// N=131072 (2^17): login hash'inden belirgin şekilde daha maliyetli — kasa
// açılışı saniyenin altında ama brute-force'u ciddi şekilde yavaşlatır.
export const DEFAULT_KDF_PARAMS: KdfParams = { N: 131072, r: 8, p: 1 };

const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // GCM için NIST önerisi (96 bit)
const SALT_LENGTH = 16;
const VERIFIER_TOKEN_LENGTH = 32;
// scrypt bellek ihtiyacı ~128*N*r byte'tır (131072*8*128 ≈ 128MiB) — Node'un
// varsayılan maxmem'i (32MiB) bunun altında kalır, açıkça yükseltilmesi gerekir.
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

export class DecryptionError extends Error {
  constructor(message = "Şifre çözülemedi — anahtar yanlış veya veri bozulmuş") {
    super(message);
    this.name = "DecryptionError";
  }
}

export function generateSalt(): string {
  return randomBytes(SALT_LENGTH).toString("hex");
}

/** Ana paroladan AES-256 anahtarı türetir. Aynı parola+salt+params HER ZAMAN aynı anahtarı üretir (deterministik). */
export function deriveKey(masterPassword: string, saltHex: string, params: KdfParams = DEFAULT_KDF_PARAMS): Buffer {
  return scryptSync(masterPassword, saltHex, KEY_LENGTH, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: SCRYPT_MAXMEM
  });
}

/** Düz metni şifreler. Dönüş formatı: "iv:authTag:ciphertext" (üçü de base64). */
export function encrypt(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/**
 * `encrypt()` çıktısını çözer. Anahtar yanlışsa VEYA veri (iv/authTag/
 * ciphertext) herhangi bir şekilde bozulmuşsa/değiştirilmişse DecryptionError
 * fırlatır — asla sessizce yanlış/çöp bir sonuç döndürmez.
 */
export function decrypt(key: Buffer, blob: string): string {
  const parts = blob.split(":");
  if (parts.length !== 3) throw new DecryptionError("Bozuk şifreli veri formatı");
  const [ivB64, authTagB64, ciphertextB64] = parts;

  try {
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    // node:crypto'nun kendi hata mesajı ("Unsupported state or unable to
    // authenticate data" vb.) kullanıcıya sızmaz — tek, net bir hata tipi.
    throw new DecryptionError();
  }
}

/**
 * Ana parolanın kendisi/hash'i HİÇBİR YERDE saklanmadan doğrulanması için:
 * rastgele (parolayla ilgisiz) bir token üretip türetilen anahtarla şifreler.
 * Doğrulama = bu blob'u çözmeyi DENEMEK — başarılıysa parola doğru demektir
 * (AES-GCM'in auth tag garantisi sayesinde, yanlış anahtarla asla başarılı
 * "çözülmüş gibi görünen" bir sonuç çıkmaz).
 */
export function createVerifier(key: Buffer): string {
  const token = randomBytes(VERIFIER_TOKEN_LENGTH).toString("base64");
  return encrypt(key, token);
}

export function checkVerifier(key: Buffer, verifier: string): boolean {
  try {
    decrypt(key, verifier);
    return true;
  } catch {
    return false;
  }
}
