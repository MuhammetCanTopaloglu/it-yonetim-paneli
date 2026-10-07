import { getWarrantyUrgency } from "../lib/warranty";

const LABELS: Record<string, string> = {
  expired: "Garanti Doldu",
  soon: "Garanti Bitiyor",
  upcoming: "Garanti Yaklaşıyor"
};

const STYLES: Record<string, string> = {
  expired: "bg-danger-soft text-danger",
  soon: "bg-warning-soft text-warning",
  upcoming: "bg-warning-soft text-warning"
};

export default function WarrantyBadge({ warrantyUntil }: { warrantyUntil: string | null }) {
  const urgency = getWarrantyUrgency(warrantyUntil);
  if (!urgency || urgency === "ok") return null;

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[urgency]}`}>
      {LABELS[urgency]}
    </span>
  );
}
