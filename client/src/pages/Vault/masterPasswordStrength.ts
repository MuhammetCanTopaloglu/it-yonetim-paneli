// Backend'deki lib/masterPasswordStrength.ts ile AYNI kural — burada sadece
// anlık geri bildirim için, gerçek doğrulama her zaman sunucuda yapılıyor.
const MIN_LENGTH = 12;

export function checkMasterPasswordStrength(password: string): { ok: boolean; reason?: string } {
  if (password.length < MIN_LENGTH) {
    return { ok: false, reason: `En az ${MIN_LENGTH} karakter olmalı (şu an ${password.length})` };
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, reason: "Tek bir karakterin tekrarından oluşamaz" };
  }
  return { ok: true };
}
