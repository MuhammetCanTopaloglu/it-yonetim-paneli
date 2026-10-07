/**
 * Kasa açıldığında türetilen AES anahtarı SADECE burada, sunucu process
 * belleğinde tutulur — DB'ye/diske ASLA yazılmaz. App session id'sine
 * bağlıdır (auth.ts'teki `sessions` tablosundan farklı, ayrı bir kavram:
 * "oturum açık" ile "kasa açık" bağımsız state'lerdir).
 *
 * 5 dakika işlemsizlikte otomatik kilitlenir (kayan pencere — her başarılı
 * kullanımda süre yenilenir). Sunucu yeniden başlarsa veya kullanıcı çıkış
 * yaparsa (auth.ts /logout, bkz. lockVaultSession çağrısı) bellek zaten
 * sıfırlanır/temizlenir. Ayrıca istemci taraf Kasa sayfasından ayrılınca veya
 * sekme/tarayıcı kapanınca da aktif olarak kilitler (bkz. client VaultPage.tsx).
 */
const VAULT_UNLOCK_TTL_MS = 5 * 60 * 1000;

interface UnlockedVault {
  key: Buffer;
  expiresAt: number;
}

const unlockedVaults = new Map<string, UnlockedVault>();

export function unlockVaultSession(appSessionId: string, key: Buffer): void {
  unlockedVaults.set(appSessionId, { key, expiresAt: Date.now() + VAULT_UNLOCK_TTL_MS });
}

/** Kasa açık ve süresi dolmamışsa anahtarı döner (ve süreyi yeniler); değilse null. */
export function getVaultKey(appSessionId: string): Buffer | null {
  const entry = unlockedVaults.get(appSessionId);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    unlockedVaults.delete(appSessionId);
    return null;
  }

  entry.expiresAt = Date.now() + VAULT_UNLOCK_TTL_MS;
  return entry.key;
}

export function isVaultUnlocked(appSessionId: string): boolean {
  return getVaultKey(appSessionId) !== null;
}

export function lockVaultSession(appSessionId: string): void {
  unlockedVaults.delete(appSessionId);
}
