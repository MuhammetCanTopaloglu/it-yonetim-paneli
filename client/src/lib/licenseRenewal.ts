export type LicenseRenewalUrgency = "expired" | "urgent" | "upcoming" | "ok";

// Garanti rozetinden farklı: burada sadece iki kademe var (aşırı katmerli
// olmasın diye kullanıcı isteği) — "urgent" görsel olarak "expired" ile aynı
// (danger) vurguyu alır, çünkü bir lisansın bitmesi yazılımı durdurabilir.
const URGENT_WINDOW_DAYS = 14;
const UPCOMING_WINDOW_DAYS = 60;

/** renewal_date boşsa null döner — çağıran taraf rozet göstermemeli. */
export function getLicenseRenewalUrgency(renewalDate: string | null): LicenseRenewalUrgency | null {
  if (!renewalDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(renewalDate);
  due.setHours(0, 0, 0, 0);

  const daysRemaining = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (daysRemaining < 0) return "expired";
  if (daysRemaining <= URGENT_WINDOW_DAYS) return "urgent";
  if (daysRemaining <= UPCOMING_WINDOW_DAYS) return "upcoming";
  return "ok";
}

export function formatRenewalDate(renewalDate: string): string {
  return new Date(renewalDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDaysRemaining(daysRemaining: number): string {
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)} gün önce doldu`;
  if (daysRemaining === 0) return "Bugün doluyor";
  return `${daysRemaining} gün kaldı`;
}

export function getDaysRemaining(renewalDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(renewalDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Dashboard'daki tek "yaklaşan" listesi (≤60 gün, expired zaten ayrı) içinde
 * satır başına renk vurgusu için — ≤14 gün (acil) danger, kalanı warning.
 * Aynı iki-kademe eşiği burada da (getLicenseRenewalUrgency ile tutarlı).
 */
export function renewalToneForDays(daysRemaining: number): "danger" | "warning" {
  return daysRemaining <= URGENT_WINDOW_DAYS ? "danger" : "warning";
}
