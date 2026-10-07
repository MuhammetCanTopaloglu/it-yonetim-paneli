import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveKey,
  encrypt,
  decrypt,
  createVerifier,
  checkVerifier,
  generateSalt,
  DecryptionError,
  type KdfParams
} from "./vaultCrypto.js";

// Testlerde gerçek DEFAULT_KDF_PARAMS (N=131072) kullanılırsa her test birkaç
// yüz ms sürer (7 test * ~300ms) — bu testlerin doğru çalıştığını kanıtlamak
// için parametrelerin BÜYÜKLÜĞÜ değil, scrypt'in KENDİSİNİN doğru
// kullanıldığı önemli. Bu yüzden testlerde daha küçük (ama yine de gerçek
// scrypt olan) parametreler kullanıyoruz — üretim kodu DEFAULT_KDF_PARAMS'ı
// kullanmaya devam ediyor, burada sadece test hızı için düşürüyoruz.
const TEST_KDF_PARAMS: KdfParams = { N: 1024, r: 8, p: 1 };

test("(a) round-trip: şifrele → çöz → aynı veri geri gelir", () => {
  const key = deriveKey("dogru-parola-123", generateSalt(), TEST_KDF_PARAMS);
  const blob = encrypt(key, "gizli-sifre-42");
  assert.equal(decrypt(key, blob), "gizli-sifre-42");
});

test("(b) yanlış parola → çözme başarısız olur (throw, sessiz çöp veri DEĞİL)", () => {
  const salt = generateSalt();
  const rightKey = deriveKey("dogru-parola-123", salt, TEST_KDF_PARAMS);
  const wrongKey = deriveKey("yanlis-parola-999", salt, TEST_KDF_PARAMS);

  const blob = encrypt(rightKey, "hassas-veri");

  assert.throws(() => decrypt(wrongKey, blob), DecryptionError);
});

test("(c) ciphertext/IV/authTag'de tek bayt bozulunca auth tag hatası (throw)", () => {
  const key = deriveKey("parola", generateSalt(), TEST_KDF_PARAMS);
  const blob = encrypt(key, "hassas-veri");
  const [iv, authTag, ciphertext] = blob.split(":");

  function flipOneByte(b64: string): string {
    const buf = Buffer.from(b64, "base64");
    buf[0] = buf[0] ^ 0xff; // ilk baytı tersine çevir
    return buf.toString("base64");
  }

  assert.throws(() => decrypt(key, `${flipOneByte(iv)}:${authTag}:${ciphertext}`), DecryptionError, "bozuk IV");
  assert.throws(
    () => decrypt(key, `${iv}:${flipOneByte(authTag)}:${ciphertext}`),
    DecryptionError,
    "bozuk authTag"
  );
  assert.throws(
    () => decrypt(key, `${iv}:${authTag}:${flipOneByte(ciphertext)}`),
    DecryptionError,
    "bozuk ciphertext"
  );
});

test("(d) aynı veriyi iki kez şifrelemek FARKLI çıktı verir (IV tazeliğinin kanıtı)", () => {
  const key = deriveKey("parola", generateSalt(), TEST_KDF_PARAMS);
  const blob1 = encrypt(key, "ayni-veri");
  const blob2 = encrypt(key, "ayni-veri");

  assert.notEqual(blob1, blob2, "iki şifreleme birebir aynı çıkmamalı (IV farklı olmalı)");
  // ama ikisi de aynı düz metne çözülmeli
  assert.equal(decrypt(key, blob1), "ayni-veri");
  assert.equal(decrypt(key, blob2), "ayni-veri");
});

test("(e) doğru parola → verifier çözülür; yanlış parola → çözülmez", () => {
  const salt = generateSalt();
  const rightKey = deriveKey("ana-parola", salt, TEST_KDF_PARAMS);
  const wrongKey = deriveKey("baska-parola", salt, TEST_KDF_PARAMS);

  const verifier = createVerifier(rightKey);

  assert.equal(checkVerifier(rightKey, verifier), true);
  assert.equal(checkVerifier(wrongKey, verifier), false);
});

test("(f) anahtar türetme deterministik: aynı parola+salt → aynı anahtar; farklı salt → farklı anahtar", () => {
  const salt = generateSalt();
  const key1 = deriveKey("parola", salt, TEST_KDF_PARAMS);
  const key2 = deriveKey("parola", salt, TEST_KDF_PARAMS);
  assert.ok(key1.equals(key2), "aynı parola+salt aynı anahtarı üretmeli");

  const otherSalt = generateSalt();
  const key3 = deriveKey("parola", otherSalt, TEST_KDF_PARAMS);
  assert.ok(!key1.equals(key3), "farklı salt farklı anahtar üretmeli");
});
