import { getLicenseRenewalUrgency } from "../lib/licenseRenewal";

const LABELS: Record<string, string> = {
  expired: "Süresi Doldu",
  urgent: "Acil Yenileme",
  upcoming: "Yenileme Yaklaşıyor"
};

const STYLES: Record<string, string> = {
  expired: "bg-danger-soft text-danger",
  urgent: "bg-danger-soft text-danger",
  upcoming: "bg-warning-soft text-warning"
};

export default function LicenseRenewalBadge({ renewalDate }: { renewalDate: string | null }) {
  const urgency = getLicenseRenewalUrgency(renewalDate);
  if (!urgency || urgency === "ok") return null;

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[urgency]}`}>
      {LABELS[urgency]}
    </span>
  );
}
