import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createTask,
  fetchTasks,
  filterTasks,
  sortByPriority,
  taskSummary,
  type DashboardState,
  type Task,
  type TaskPriority,
} from "./api";

export function Dashboard() {
  const [state, setState] = useState<DashboardState>({
    tasks: [],
    filter: "all",
    loading: true,
    error: null,
  });
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(3);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const tasks = await fetchTasks();
      setState((s) => ({ ...s, tasks, loading: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => sortByPriority(filterTasks(state.tasks, state.filter)),
    [state.tasks, state.filter]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask(title.trim(), "", priority);
    setTitle("");
    await load();
  }

  return (
    <div className="dashboard">
      <header>
        <h1>RepoPilot Demo Dashboard</h1>
        <p>{taskSummary(state.tasks)}</p>
      </header>

      <form onSubmit={onSubmit}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task…"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value) as TaskPriority)}
        >
          {[1, 2, 3, 4, 5].map((p) => (
            <option key={p} value={p}>
              P{p}
            </option>
          ))}
        </select>
        <button type="submit">Add</button>
      </form>

      <div className="filters">
        {(["all", "active", "done"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={state.filter === f ? "active" : ""}
            onClick={() => setState((s) => ({ ...s, filter: f }))}
          >
            {f}
          </button>
        ))}
      </div>

      {state.loading && <p>Loading…</p>}
      {state.error && <p className="error">{state.error}</p>}

      <ul className="task-list">
        {visible.map((task: Task) => (
          <li key={task.id} className={task.completed ? "done" : ""}>
            <strong>{task.title}</strong>
            <span>P{task.priority}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Dashboard;
