import type { TodoPriority } from "../types";

const LABELS: Record<TodoPriority, string> = {
  dusuk: "Düşük",
  orta: "Orta",
  yuksek: "Yüksek"
};

const STYLES: Record<TodoPriority, string> = {
  dusuk: "bg-surface-secondary text-secondary",
  orta: "bg-warning-soft text-warning",
  yuksek: "bg-danger-soft text-danger"
};

export default function PriorityBadge({ priority }: { priority: TodoPriority }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[priority]}`}>
      {LABELS[priority]}
    </span>
  );
}
