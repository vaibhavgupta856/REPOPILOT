import { useEffect, useState } from "react";

export interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  commands: CommandItem[];
  onClose: () => void;
}

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const [filter, setFilter] = useState("");
  const [index, setIndex] = useState(0);

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(filter.toLowerCase()),
  );

  useEffect(() => {
    if (!open) {
      setFilter("");
      setIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [filter]);

  if (!open) return null;

  function run(cmd: CommandItem) {
    cmd.run();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="forge-glass-strong w-full max-w-lg overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, filtered.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter" && filtered[index]) run(filtered[index]);
          }}
          placeholder="Type a command…"
          className="w-full border-b border-white/10 bg-transparent px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />
        <ul className="max-h-64 overflow-y-auto py-1">
          {filtered.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                type="button"
                onClick={() => run(cmd)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                  i === index ? "bg-orange-500/15 text-orange-200" : "text-zinc-300 hover:bg-white/5"
                }`}
              >
                <span>{cmd.label}</span>
                {cmd.shortcut && (
                  <span className="font-mono-forge text-[10px] text-zinc-600">{cmd.shortcut}</span>
                )}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-zinc-600">No matching commands</li>
          )}
        </ul>
      </div>
    </div>
  );
}

interface QuickOpenProps {
  open: boolean;
  files: string[];
  onClose: () => void;
  onOpen: (path: string) => void;
}

export function QuickOpen({ open, files, onClose, onOpen }: QuickOpenProps) {
  const [filter, setFilter] = useState("");
  const [index, setIndex] = useState(0);

  const filtered = files
    .filter((f) => f.toLowerCase().includes(filter.toLowerCase()))
    .slice(0, 30);

  useEffect(() => {
    if (!open) {
      setFilter("");
      setIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [filter]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="forge-glass-strong w-full max-w-lg overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, filtered.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter" && filtered[index]) {
              onOpen(filtered[index]);
              onClose();
            }
          }}
          placeholder="Go to file…"
          className="w-full border-b border-white/10 bg-transparent px-4 py-3 font-mono-forge text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />
        <ul className="max-h-72 overflow-y-auto py-1">
          {filtered.map((path, i) => (
            <li key={path}>
              <button
                type="button"
                onClick={() => {
                  onOpen(path);
                  onClose();
                }}
                className={`w-full truncate px-4 py-2 text-left font-mono-forge text-sm ${
                  i === index ? "bg-orange-500/15 text-orange-200" : "text-zinc-300 hover:bg-white/5"
                }`}
              >
                {path}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
