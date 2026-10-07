// Kasa tüm güvenliği bu parolaya dayandığı için minimum bir alt sınır var —
// ama aşırı katı bir politika (özel karakter zorunluluğu vb.) kullanıcının
// unutmasını kolaylaştırır, bu yüzden sadece uzunluk + bariz-zayıf desenler
// engelleniyor ("aşırı katı olma" kararına göre).
const MIN_MASTER_PASSWORD_LENGTH = 12;

export function checkMasterPasswordStrength(password: string): { ok: true } | { ok: false; reason: string } {
  if (password.length < MIN_MASTER_PASSWORD_LENGTH) {
    return { ok: false, reason: `Ana parola en az ${MIN_MASTER_PASSWORD_LENGTH} karakter olmalı` };
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, reason: "Ana parola tek bir karakterin tekrarından oluşamaz" };
  }
  return { ok: true };
}
