import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { createTodo, deleteTodo, listTodos, reorderTodos, updateTodo } from "../../api/todos";
import { listInventory } from "../../api/inventory";
import type { InventoryItem, Todo, TodoFormData, TodoStatus } from "../../types";
import Modal from "../../components/Modal";
import Column from "./Column";
import TodoForm from "./TodoForm";

const COLUMNS: { status: TodoStatus; title: string }[] = [
  { status: "bekliyor", title: "Bekliyor" },
  { status: "devam_ediyor", title: "Devam Ediyor" },
  { status: "tamam", title: "Tamam" }
];

type ColumnsState = Record<TodoStatus, Todo[]>;

function groupByStatus(tasks: Todo[]): ColumnsState {
  const grouped: ColumnsState = { bekliyor: [], devam_ediyor: [], tamam: [] };
  for (const task of tasks) {
    grouped[task.status].push(task);
  }
  for (const status of Object.keys(grouped) as TodoStatus[]) {
    grouped[status].sort((a, b) => a.sort_order - b.sort_order);
  }
  return grouped;
}

export default function TodoPage() {
  const [columns, setColumns] = useState<ColumnsState>({ bekliyor: [], devam_ediyor: [], tamam: [] });
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Todo | undefined>(undefined);
  const [deletingTask, setDeletingTask] = useState<Todo | undefined>(undefined);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [tasks, inv] = await Promise.all([listTodos(), listInventory({})]);
      setColumns(groupByStatus(tasks));
      setInventory(inv);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function findContainer(id: string): TodoStatus | undefined {
    if (COLUMNS.some((c) => c.status === id)) return id as TodoStatus;
    return (Object.keys(columns) as TodoStatus[]).find((status) =>
      columns[status].some((t) => t.id === id)
    );
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(String(active.id));
    const overContainer = findContainer(String(over.id));
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setColumns((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex((t) => t.id === active.id);
      if (activeIndex === -1) return prev;

      const overIndex = overItems.findIndex((t) => t.id === over.id);
      const newIndex = overIndex >= 0 ? overIndex : overItems.length;

      const activeTask = activeItems[activeIndex];
      const newActiveItems = activeItems.filter((t) => t.id !== active.id);
      const newOverItems = [...overItems];
      newOverItems.splice(newIndex, 0, { ...activeTask, status: overContainer });

      return { ...prev, [activeContainer]: newActiveItems, [overContainer]: newOverItems };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(String(active.id));
    const overContainer = findContainer(String(over.id));
    if (!activeContainer || !overContainer) return;

    let finalColumns = columns;

    if (activeContainer === overContainer) {
      const items = columns[activeContainer];
      const activeIndex = items.findIndex((t) => t.id === active.id);
      const overIndex = items.findIndex((t) => t.id === over.id);
      if (activeIndex !== overIndex && overIndex >= 0) {
        finalColumns = { ...columns, [activeContainer]: arrayMove(items, activeIndex, overIndex) };
        setColumns(finalColumns);
      }
    }

    persist(finalColumns);
  }

  async function persist(state: ColumnsState) {
    try {
      await reorderTodos({
        bekliyor: state.bekliyor.map((t) => t.id),
        devam_ediyor: state.devam_ediyor.map((t) => t.id),
        tamam: state.tamam.map((t) => t.id)
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sıralama kaydedilemedi");
      await load();
    }
  }

  function openCreate() {
    setEditingTask(undefined);
    setModalOpen(true);
  }

  function openEdit(task: Todo) {
    setEditingTask(task);
    setModalOpen(true);
  }

  async function handleSubmit(data: TodoFormData) {
    if (editingTask) {
      await updateTodo(editingTask.id, data);
    } else {
      await createTodo(data);
    }
    setModalOpen(false);
    await load();
  }

  async function handleDelete() {
    if (!deletingTask) return;
    await deleteTodo(deletingTask.id);
    setDeletingTask(undefined);
    await load();
  }

  const totalCount = useMemo(
    () => columns.bekliyor.length + columns.devam_ediyor.length + columns.tamam.length,
    [columns]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">To-Do</h2>
          <p className="text-sm text-secondary">{totalCount} görev</p>
        </div>
        <button
          onClick={openCreate}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover"
        >
          + Yeni Görev
        </button>
      </div>

      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      {loading && <p className="text-sm text-tertiary">Yükleniyor...</p>}

      {!loading && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col sm:flex-row gap-4">
            {COLUMNS.map((col) => (
              <Column
                key={col.status}
                status={col.status}
                title={col.title}
                tasks={columns[col.status]}
                inventory={inventory}
                onEditTask={openEdit}
                onDeleteTask={setDeletingTask}
              />
            ))}
          </div>
        </DndContext>
      )}

      {modalOpen && (
        <Modal title={editingTask ? "Görevi Düzenle" : "Yeni Görev"} onClose={() => setModalOpen(false)}>
          <TodoForm item={editingTask} inventory={inventory} onSubmit={handleSubmit} onCancel={() => setModalOpen(false)} />
        </Modal>
      )}

      {deletingTask && (
        <Modal title="Silme Onayı" onClose={() => setDeletingTask(undefined)}>
          <p className="text-sm mb-4">
            <strong>{deletingTask.title}</strong> görevini silmek istediğinize emin misiniz?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeletingTask(undefined)}
              className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
            >
              Vazgeç
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-sm rounded-md bg-danger text-white hover:brightness-90"
            >
              Sil
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
