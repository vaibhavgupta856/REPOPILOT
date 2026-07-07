import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceFileInfo } from "../lib/api";
import { getRepoFile, saveRepoFile } from "../lib/api";

interface SearchPanelProps {
  repoId: string;
  files: WorkspaceFileInfo[];
  onOpenFile: (path: string, line?: number) => void;
  onRefresh: () => void;
}

interface SearchHit {
  path: string;
  line: number;
  preview: string;
}

function matchesQuery(
  text: string,
  query: string,
  opts: { regex: boolean; caseSensitive: boolean; wholeWord: boolean },
): boolean {
  if (!query) return false;
  if (opts.regex) {
    try {
      const flags = opts.caseSensitive ? "" : "i";
      const pattern = opts.wholeWord ? `\\b${query}\\b` : query;
      return new RegExp(pattern, flags).test(text);
    } catch {
      return false;
    }
  }
  const hay = opts.caseSensitive ? text : text.toLowerCase();
  const needle = opts.caseSensitive ? query : query.toLowerCase();
  if (opts.wholeWord) {
    return new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, opts.caseSensitive ? "" : "i").test(text);
  }
  return hay.includes(needle);
}

export function SearchPanel({ repoId, files, onOpenFile, onRefresh }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [replace, setReplace] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const filePaths = useMemo(
    () => files.filter((f) => !f.is_dir).map((f) => f.path),
    [files],
  );

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    const q = query.trim();
    if (!q) {
      setHits([]);
      setSearching(false);
      return;
    }

    const opts = { regex: useRegex, caseSensitive, wholeWord };
    const nameHits = filePaths
      .filter((p) => matchesQuery(p, q, opts))
      .slice(0, 20)
      .map((path) => ({ path, line: 0, preview: path }));

    setHits(nameHits);
    setSearching(true);

    debounceRef.current = window.setTimeout(async () => {
      const contentHits: SearchHit[] = [];
      const toScan = filePaths.slice(0, 60);

      await Promise.all(
        toScan.map(async (path) => {
          try {
            const detail = await getRepoFile(repoId, path);
            const lines = detail.current.split("\n");
            lines.forEach((line, i) => {
              if (matchesQuery(line, q, opts)) {
                contentHits.push({
                  path,
                  line: i + 1,
                  preview: line.trim().slice(0, 120),
                });
              }
            });
          } catch {
            /* skip */
          }
        }),
      );

      const merged = new Map<string, SearchHit>();
      for (const h of [...nameHits, ...contentHits]) {
        const key = `${h.path}:${h.line}`;
        if (!merged.has(key)) merged.set(key, h);
      }
      setHits(Array.from(merged.values()).slice(0, 80));
      setSearching(false);
    }, 350);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, filePaths, repoId, caseSensitive, wholeWord, useRegex]);

  async function replaceAll() {
    const q = query.trim();
    if (!q || !replace) return;
    setReplacing(true);
    const opts = { regex: useRegex, caseSensitive, wholeWord };
    const touched = new Set<string>();

    try {
      for (const path of filePaths) {
        try {
          const detail = await getRepoFile(repoId, path);
          const lines = detail.current.split("\n");
          let changed = false;
          const next = lines.map((line) => {
            if (!matchesQuery(line, q, opts)) return line;
            changed = true;
            if (useRegex) {
              try {
                const flags = caseSensitive ? "g" : "gi";
                const pattern = wholeWord ? `\\b(${q})\\b` : q;
                return line.replace(new RegExp(pattern, flags), replace);
              } catch {
                return line;
              }
            }
            if (wholeWord) {
              const re = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, caseSensitive ? "g" : "gi");
              return line.replace(re, replace);
            }
            if (caseSensitive) return line.split(q).join(replace);
            return line.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replace);
          });
          if (changed) {
            await saveRepoFile(repoId, path, next.join("\n"));
            touched.add(path);
          }
        } catch {
          /* skip */
        }
      }
      if (touched.size > 0) onRefresh();
    } finally {
      setReplacing(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <p className="forge-panel-title shrink-0 border-b border-white/5 px-3 py-2 text-[10px] font-semibold uppercase text-zinc-600">
        Search
      </p>
      <div className="space-y-2 border-b border-white/5 p-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="forge-input w-full rounded-lg px-2.5 py-1.5 font-mono-forge text-[11px]"
        />
        {showReplace && (
          <input
            type="text"
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="Replace"
            className="forge-input w-full rounded-lg px-2.5 py-1.5 font-mono-forge text-[11px]"
          />
        )}
        <div className="flex flex-wrap gap-1">
          <ToggleBtn label="Aa" title="Match case" active={caseSensitive} onClick={() => setCaseSensitive((v) => !v)} />
          <ToggleBtn label="ab" title="Whole word" active={wholeWord} onClick={() => setWholeWord((v) => !v)} />
          <ToggleBtn label=".*" title="Regex" active={useRegex} onClick={() => setUseRegex((v) => !v)} />
          <ToggleBtn label="⇄" title="Replace" active={showReplace} onClick={() => setShowReplace((v) => !v)} />
        </div>
        {showReplace && query && (
          <button
            type="button"
            disabled={replacing || !replace}
            onClick={() => replaceAll().catch(() => {})}
            className="w-full rounded-lg bg-orange-500/15 py-1 text-[10px] font-medium text-orange-300 hover:bg-orange-500/25 disabled:opacity-50"
          >
            {replacing ? "Replacing…" : "Replace all in project"}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {searching && <p className="px-2 text-[10px] text-zinc-600">Searching…</p>}
        {!query && <p className="px-2 text-xs text-zinc-600">Search filenames and contents</p>}
        {query && !searching && hits.length === 0 && (
          <p className="px-2 text-xs text-zinc-600">No results</p>
        )}
        {hits.map((hit) => (
          <button
            key={`${hit.path}:${hit.line}`}
            type="button"
            onClick={() => onOpenFile(hit.path, hit.line > 0 ? hit.line : undefined)}
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

function ToggleBtn({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded px-2 py-0.5 font-mono-forge text-[10px] ${
        active ? "bg-orange-500/20 text-orange-300" : "bg-white/5 text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}
