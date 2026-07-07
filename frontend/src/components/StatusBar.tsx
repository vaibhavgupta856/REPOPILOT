import { displayLanguage } from "../lib/languageFromPath";

interface StatusBarProps {
  path: string | null;
  line: number;
  column: number;
  dirty: boolean;
  branch?: string;
  tabSize?: number;
}

export function StatusBar({ path, line, column, dirty, branch = "main", tabSize = 2 }: StatusBarProps) {
  return (
    <div className="flex shrink-0 items-center justify-between border-t border-white/5 bg-[#007acc]/20 px-3 py-0.5 font-mono-forge text-[10px] text-zinc-300">
      <div className="flex items-center gap-3">
        <span className="text-sky-300">⎇ {branch}</span>
        {path && (
          <>
            <span className="text-zinc-500">{path}</span>
            {dirty && <span className="text-orange-300">● Modified</span>}
          </>
        )}
      </div>
      <div className="flex items-center gap-3 text-zinc-400">
        {path && <span>{displayLanguage(path)}</span>}
        {path && (
          <span>
            Ln {line}, Col {column}
          </span>
        )}
        <span>UTF-8</span>
        <span>Spaces: {tabSize}</span>
      </div>
    </div>
  );
}
