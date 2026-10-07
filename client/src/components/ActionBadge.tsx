import type { ChangelogAction } from "../types";

const LABELS: Record<ChangelogAction, string> = {
  create: "Oluşturuldu",
  update: "Güncellendi",
  delete: "Silindi",
  note: "Not"
};

const STYLES: Record<ChangelogAction, string> = {
  create: "bg-success-soft text-success",
  update: "bg-warning-soft text-warning",
  delete: "bg-danger-soft text-danger",
  note: "bg-surface-secondary text-secondary"
};

export default function ActionBadge({ action }: { action: ChangelogAction }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[action]}`}>
      {LABELS[action]}
    </span>
  );
}
