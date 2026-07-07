import { extractSymbols, symbolIcon, type FileSymbol } from "../lib/extractSymbols";

interface OutlinePanelProps {
  path: string | null;
  content: string;
  onGoToLine: (line: number) => void;
}

export function OutlinePanel({ path, content, onGoToLine }: OutlinePanelProps) {
  const symbols: FileSymbol[] = path ? extractSymbols(content, path) : [];

  return (
    <div className="flex h-full flex-col">
      <p className="forge-panel-title shrink-0 border-b border-white/5 px-3 py-2 text-[10px] font-semibold uppercase text-zinc-600">
        Outline
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!path && <p className="px-2 text-xs text-zinc-600">Open a file to see symbols</p>}
        {path && symbols.length === 0 && (
          <p className="px-2 text-xs text-zinc-600">No symbols found in this file</p>
        )}
        {symbols.map((sym, i) => (
          <button
            key={`${sym.line}-${sym.name}-${i}`}
            type="button"
            onClick={() => onGoToLine(sym.line)}
            className="mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          >
            <span className="w-3 shrink-0 text-center text-[10px] text-violet-400/80">
              {symbolIcon(sym.kind)}
            </span>
            <span className="truncate font-mono-forge">{sym.name}</span>
            <span className="ml-auto shrink-0 text-[9px] text-zinc-600">:{sym.line}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
