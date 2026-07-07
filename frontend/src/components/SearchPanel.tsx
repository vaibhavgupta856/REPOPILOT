import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceFileInfo } from "../lib/api";
import { getRepoFile } from "../lib/api";

interface SearchPanelProps {
  repoId: string;
  files: WorkspaceFileInfo[];
  onOpenFile: (path: string) => void;
}

interface SearchHit {
  path: string;
  line: number;
  preview: string;
}

export function SearchPanel({ repoId, files, onOpenFile }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const filePaths = useMemo(
    () => files.filter((f) => !f.is_dir).map((f) => f.path),
    [files],
  );

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    const q = query.trim().toLowerCase();
    if (!q) {
      setHits([]);
      setSearching(false);
      return;
    }

    const nameHits = filePaths
      .filter((p) => p.toLowerCase().includes(q))
      .slice(0, 20)
      .map((path) => ({ path, line: 0, preview: path }));

    setHits(nameHits);
    setSearching(true);

    debounceRef.current = window.setTimeout(async () => {
      const contentHits: SearchHit[] = [];
      const toScan = filePaths.slice(0, 40);

      await Promise.all(
        toScan.map(async (path) => {
          try {
            const detail = await getRepoFile(repoId, path);
            const lines = detail.current.split("\n");
            lines.forEach((line, i) => {
              if (line.toLowerCase().includes(q)) {
                contentHits.push({
                  path,
                  line: i + 1,
                  preview: line.trim().slice(0, 120),
                });
              }
            });
          } catch {
            /* skip unreadable */
          }
        }),
      );

      const merged = new Map<string, SearchHit>();
      for (const h of [...nameHits, ...contentHits]) {
        const key = `${h.path}:${h.line}`;
        if (!merged.has(key)) merged.set(key, h);
      }
      setHits(Array.from(merged.values()).slice(0, 50));
      setSearching(false);
    }, 350);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, filePaths, repoId]);

  return (
    <div className="flex h-full flex-col">
      <p className="forge-panel-title shrink-0 border-b border-white/5 px-3 py-2 text-[10px] font-semibold uppercase text-zinc-600">
        Search
      </p>
      <div className="border-b border-white/5 p-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files & content…"
          className="forge-input w-full rounded-lg px-2.5 py-1.5 font-mono-forge text-[11px]"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {searching && <p className="px-2 text-[10px] text-zinc-600">Searching…</p>}
        {!query && <p className="px-2 text-xs text-zinc-600">Type to search filenames and file contents</p>}
        {query && !searching && hits.length === 0 && (
          <p className="px-2 text-xs text-zinc-600">No results</p>
        )}
        {hits.map((hit) => (
          <button
            key={`${hit.path}:${hit.line}`}
            type="button"
            onClick={() => onOpenFile(hit.path)}
            className="mb-1 w-full rounded-md px-2 py-1.5 text-left transition hover:bg-white/5"
          >
            <p className="truncate font-mono-forge text-[11px] text-orange-200/90">{hit.path}</p>
            {hit.line > 0 && (
              <p className="truncate text-[10px] text-zinc-500">
                L{hit.line}: {hit.preview}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
