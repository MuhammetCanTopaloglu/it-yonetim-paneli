export type DueUrgency = "overdue" | "today" | "normal";

export function getDueUrgency(dueDate: string | null): DueUrgency {
  if (!dueDate) return "normal";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  if (due.getTime() < today.getTime()) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  return "normal";
}

export function formatDueDate(dueDate: string): string {
  const d = new Date(dueDate);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
