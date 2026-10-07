import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { InventoryItem, Todo } from "../../types";
import PriorityBadge from "../../components/PriorityBadge";
import { formatDueDate, getDueUrgency } from "../../lib/dueDate";

const URGENCY_CLASS: Record<string, string> = {
  overdue: "text-danger font-medium",
  today: "text-warning font-medium",
  normal: "text-secondary"
};

export default function TaskCard({
  task,
  inventoryName,
  onEdit,
  onDelete
}: {
  task: Todo;
  inventoryName?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id
  });

  const style = {
    transform: isDragging ? `${CSS.Transform.toString(transform)} scale(1.03)` : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };

  const urgency = getDueUrgency(task.due_date);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-surface p-3 touch-none transition-shadow duration-150 ${
        isDragging ? "shadow-card" : "shadow-sm"
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h4 className="text-sm font-medium">{task.title}</h4>
          <PriorityBadge priority={task.priority} />
        </div>
        {task.description && (
          <p className="text-xs text-secondary mb-2 line-clamp-2">{task.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {task.due_date && (
            <span className={URGENCY_CLASS[urgency]}>
              {urgency === "overdue" ? "Gecikti: " : urgency === "today" ? "Bugün: " : ""}
              {formatDueDate(task.due_date)}
            </span>
          )}
          {inventoryName && (
            <span className="text-secondary">🖥 {inventoryName}</span>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-2 pt-2 border-t text-xs">
        <button onClick={onEdit} className="text-accent hover:underline">
          Düzenle
        </button>
        <button onClick={onDelete} className="text-danger hover:underline">
          Sil
        </button>
      </div>
    </div>
  );
}

export function findInventoryName(inventory: InventoryItem[], id: string | null): string | undefined {
  if (!id) return undefined;
  return inventory.find((i) => i.id === id)?.name;
}
