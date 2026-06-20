import { useEffect, useRef, useState } from "react";
import { runTerminalCommand } from "../lib/api";

interface TerminalLine {
  id: number;
  type: "in" | "out" | "err" | "sys";
  text: string;
}

interface RepoTerminalProps {
  repoId: string;
  onCommandComplete?: () => void;
}

let lineId = 0;

const WELCOME =
  "RepoPilot terminal — runs in your cloned repo on this machine.\n" +
  "Examples: dir · pip install -r requirements.txt · npm install · Remove-Item file.txt\n" +
  "Note: gcc/python must already be installed on the server (cannot apt/winget install without admin).";

export function RepoTerminal({ repoId, onCommandComplete }: RepoTerminalProps) {
  const [cwd, setCwd] = useState(".");
  const [shell, setShell] = useState("");
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: lineId++, type: "sys", text: WELCOME },
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, running]);

  function append(type: TerminalLine["type"], text: string) {
    if (!text) return;
    setLines((prev) => [...prev, { id: lineId++, type, text }]);
  }

  async function execute(raw: string) {
    const command = raw.trim();
    if (!command || running) return;

    append("in", `$ ${command}`);
    setInput("");
    setHistory((prev) => [command, ...prev.filter((c) => c !== command)].slice(0, 50));
    setHistoryIdx(-1);

    if (command === "clear") {
      setLines([]);
      return;
    }

    setRunning(true);
    try {
      const result = await runTerminalCommand(repoId, command, cwd);
      setCwd(result.cwd);
      if (result.shell) setShell(result.shell);
      if (result.stdout) append("out", result.stdout.replace(/\n$/, ""));
      if (result.stderr) append("err", result.stderr.replace(/\n$/, ""));
      if (!result.stdout && !result.stderr && result.exit_code === 0 && !command.startsWith("cd")) {
        append("sys", "(command completed — file list refreshed if files changed)");
      }
      if (result.exit_code !== 0) {
        append("sys", `[exit ${result.exit_code}]`);
      }
      onCommandComplete?.();
    } catch (err) {
      append("err", err instanceof Error ? err.message : "Command failed");
    } finally {
      setRunning(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      execute(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const next = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(next);
      setInput(history[next] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx <= 0) {
        setHistoryIdx(-1);
        setInput("");
        return;
      }
      const next = historyIdx - 1;
      setHistoryIdx(next);
      setInput(history[next] ?? "");
    }
  }

  const prompt = cwd === "." ? "$" : `$ ${cwd}`;
  const shellLabel = shell ? ` · ${shell}` : "";

  return (
    <div className="flex h-full flex-col bg-[#0a0a0e]">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-3 font-mono-forge text-[12px] leading-relaxed"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            className={`whitespace-pre-wrap break-words ${
              line.type === "in"
                ? "text-orange-300/90"
                : line.type === "err"
                  ? "text-red-400"
                  : line.type === "sys"
                    ? "text-zinc-600"
                    : "text-zinc-300"
            }`}
          >
            {line.text}
          </div>
        ))}
        {running && <div className="forge-agent-working text-zinc-500">Running…</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-white/5 bg-black/40 px-3 py-2">
        <span className="shrink-0 font-mono-forge text-xs text-emerald-500/80" title={shellLabel || "shell"}>
          {prompt}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={running}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent font-mono-forge text-sm text-zinc-100 outline-none placeholder:text-zinc-700"
          placeholder="Enter command…"
        />
      </div>
    </div>
  );
}
