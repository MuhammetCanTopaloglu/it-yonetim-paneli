import type { InventoryStatus } from "../types";

const LABELS: Record<InventoryStatus, string> = {
  aktif: "Aktif",
  arizali: "Arızalı",
  yedek: "Yedek",
  hurda: "Hurda"
};

const STYLES: Record<InventoryStatus, string> = {
  aktif: "bg-success-soft text-success",
  arizali: "bg-danger-soft text-danger",
  yedek: "bg-warning-soft text-warning",
  hurda: "bg-surface-secondary text-secondary"
};

export default function StatusBadge({ status }: { status: InventoryStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
