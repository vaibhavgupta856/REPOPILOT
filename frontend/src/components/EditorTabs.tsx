interface EditorTabsProps {
  tabs: string[];
  active: string | null;
  dirtyPaths: Set<string>;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export function EditorTabs({ tabs, active, dirtyPaths, onSelect, onClose }: EditorTabsProps) {
  if (tabs.length === 0) {
    return (
      <div className="flex shrink-0 items-center border-b border-white/5 bg-[#0a0a0e] px-3 py-2 text-xs text-zinc-600">
        No editors open
      </div>
    );
  }

  return (
    <div className="flex shrink-0 overflow-x-auto border-b border-white/5 bg-[#0a0a0e]">
      {tabs.map((path) => {
        const name = path.split("/").pop() ?? path;
        const isActive = active === path;
        const dirty = dirtyPaths.has(path);
        return (
          <div
            key={path}
            className={`group flex shrink-0 items-center gap-1 border-r border-white/5 px-1 ${
              isActive ? "bg-[#0c0c10]" : "bg-black/20 hover:bg-white/[0.03]"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(path)}
              title={path}
              className={`flex items-center gap-1.5 px-2 py-2 text-xs ${
                isActive ? "text-orange-200" : "text-zinc-500 group-hover:text-zinc-300"
              }`}
            >
              <span className="font-mono-forge">{name}</span>
              {dirty && <span className="h-2 w-2 rounded-full bg-orange-400" />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(path);
              }}
              className="rounded px-1 text-[10px] text-zinc-600 opacity-0 transition hover:bg-white/10 hover:text-zinc-300 group-hover:opacity-100"
              title="Close"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
