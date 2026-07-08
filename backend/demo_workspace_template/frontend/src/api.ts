/**
 * Demo dashboard — sample TypeScript for outline, breadcrumbs, and search.
 */

export type TaskPriority = 1 | 2 | 3 | 4 | 5;

export interface Task {
  id: number;
  title: string;
  description: string;
  priority: TaskPriority;
  completed: boolean;
  createdAt: string;
}

export interface DashboardState {
  tasks: Task[];
  filter: "all" | "active" | "done";
  loading: boolean;
  error: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/tasks`);
  if (!res.ok) throw new Error(`Failed to load tasks (${res.status})`);
  return res.json();
}

export async function createTask(
  title: string,
  description = "",
  priority: TaskPriority = 3
): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, priority }),
  });
  if (!res.ok) throw new Error("Create failed");
  return res.json();
}

export function filterTasks(tasks: Task[], filter: DashboardState["filter"]): Task[] {
  switch (filter) {
    case "active":
      return tasks.filter((t) => !t.completed);
    case "done":
      return tasks.filter((t) => t.completed);
    default:
      return tasks;
  }
}

export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => b.priority - a.priority);
}

export function taskSummary(tasks: Task[]): string {
  const done = tasks.filter((t) => t.completed).length;
  return `${done}/${tasks.length} completed`;
}

// Repilot demo: try Ctrl+Shift+O → createTask
