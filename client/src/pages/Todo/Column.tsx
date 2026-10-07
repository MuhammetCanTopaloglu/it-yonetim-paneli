import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { InventoryItem, Todo, TodoStatus } from "../../types";
import TaskCard, { findInventoryName } from "./TaskCard";

export default function Column({
  status,
  title,
  tasks,
  inventory,
  onEditTask,
  onDeleteTask
}: {
  status: TodoStatus;
  title: string;
  tasks: Todo[];
  inventory: InventoryItem[];
  onEditTask: (task: Todo) => void;
  onDeleteTask: (task: Todo) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex-1 min-w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">{title}</h3>
        <span className="text-xs text-tertiary bg-surface-secondary rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 rounded-lg border-2 border-dashed p-2 min-h-[200px] transition-colors ${
          isOver ? "border-accent bg-accent/5" : "border-transparent"
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              inventoryName={findInventoryName(inventory, task.related_inventory_id)}
              onEdit={() => onEditTask(task)}
              onDelete={() => onDeleteTask(task)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <p className="text-xs text-tertiary text-center py-6">Görev yok</p>
        )}
      </div>
    </div>
  );
}
