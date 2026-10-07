export type WarrantyUrgency = "expired" | "soon" | "upcoming" | "ok";

const UPCOMING_WINDOW_DAYS = 90;
const SOON_WINDOW_DAYS = 30;

/** warranty_until boşsa null döner — çağıran taraf rozet göstermemeli. */
export function getWarrantyUrgency(warrantyUntil: string | null): WarrantyUrgency | null {
  if (!warrantyUntil) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(warrantyUntil);
  due.setHours(0, 0, 0, 0);

  const daysRemaining = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (daysRemaining < 0) return "expired";
  if (daysRemaining <= SOON_WINDOW_DAYS) return "soon";
  if (daysRemaining <= UPCOMING_WINDOW_DAYS) return "upcoming";
  return "ok";
}

export function formatWarrantyDate(warrantyUntil: string): string {
  return new Date(warrantyUntil).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDaysRemaining(daysRemaining: number): string {
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)} gün önce doldu`;
  if (daysRemaining === 0) return "Bugün doluyor";
  return `${daysRemaining} gün kaldı`;
}
