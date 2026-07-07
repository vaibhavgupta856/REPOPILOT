interface BreadcrumbsProps {
  path: string | null;
  onSelectSegment?: (path: string) => void;
}

export function Breadcrumbs({ path, onSelectSegment }: BreadcrumbsProps) {
  if (!path) return null;

  const parts = path.split("/").filter(Boolean);

  return (
    <nav className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-white/5 bg-black/30 px-3 py-1 font-mono-forge text-[10px] text-zinc-500">
      {parts.map((part, i) => {
        const segmentPath = parts.slice(0, i + 1).join("/");
        const isLast = i === parts.length - 1;
        return (
          <span key={segmentPath} className="flex shrink-0 items-center gap-0.5">
            {i > 0 && <span className="text-zinc-700">›</span>}
            {isLast ? (
              <span className="text-orange-300/90">{part}</span>
            ) : (
              <button
                type="button"
                onClick={() => onSelectSegment?.(segmentPath)}
                className="rounded px-0.5 hover:bg-white/5 hover:text-zinc-300"
              >
                {part}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
