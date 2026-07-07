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

const WELCOME_LINES = [
  "RepoPilot shell · commands run in your cloned repo",
  "Try: dir  ·  pip install -r requirements.txt  ·  npm install",
];

function linePrefix(type: TerminalLine["type"]): string {
  switch (type) {
    case "in":
      return "❯";
    case "err":
      return "✕";
    case "sys":
      return "·";
    default:
      return " ";
  }
}

export function RepoTerminal({ repoId, onCommandComplete }: RepoTerminalProps) {
  const [cwd, setCwd] = useState(".");
  const [shell, setShell] = useState("powershell");
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: lineId++, type: "sys", text: WELCOME_LINES[0] },
    { id: lineId++, type: "sys", text: WELCOME_LINES[1] },
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const refocusAfterRun = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, running]);

  useEffect(() => {
    if (!running && refocusAfterRun.current) {
      refocusAfterRun.current = false;
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [running]);

  function append(type: TerminalLine["type"], text: string) {
    if (!text) return;
    setLines((prev) => [...prev, { id: lineId++, type, text }]);
  }

  async function execute(raw: string) {
    const command = raw.trim();
    if (!command || running) return;

    append("in", command);
    setInput("");
    setHistory((prev) => [command, ...prev.filter((c) => c !== command)].slice(0, 50));
    setHistoryIdx(-1);

    if (command === "clear") {
      setLines([]);
      refocusAfterRun.current = true;
      return;
    }

    setRunning(true);
    refocusAfterRun.current = true;
    try {
      const result = await runTerminalCommand(repoId, command, cwd);
      setCwd(result.cwd);
      if (result.shell) setShell(result.shell);
      if (result.stdout) append("out", result.stdout.replace(/\n$/, ""));
      if (result.stderr) append("err", result.stderr.replace(/\n$/, ""));
      if (!result.stdout && !result.stderr && result.exit_code === 0 && !command.startsWith("cd")) {
        append("sys", "done — file list refreshed");
      }
      if (result.exit_code !== 0) {
        append("sys", `exit code ${result.exit_code}`);
      }
      if (result.exit_code === 0 && !command.startsWith("cd")) {
        onCommandComplete?.();
      }
    } catch (err) {
      append("err", err instanceof Error ? err.message : "Command failed");
    } finally {
      setRunning(false);
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

  const cwdDisplay = cwd === "." ? "~" : cwd;

  return (
    <div className="forge-terminal flex h-full flex-col overflow-hidden">
      {/* Title bar */}
      <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/5 bg-black/50 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80 shadow-[0_0_6px_rgba(251,191,36,0.35)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80 shadow-[0_0_6px_rgba(52,211,153,0.35)]" />
          </div>
          <span className="text-[11px] font-medium tracking-wide text-zinc-400">Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono-forge text-[10px] text-emerald-400/90 ring-1 ring-emerald-500/20">
            {shell || "shell"}
          </span>
          <span className="hidden max-w-[140px] truncate font-mono-forge text-[10px] text-zinc-600 sm:inline">
            {cwdDisplay}
          </span>
        </div>
      </div>

      {/* Output */}
      <div
        ref={scrollRef}
        className="forge-terminal-scroll relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono-forge text-[12px] leading-[1.65]"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.length === 0 && (
          <p className="mb-3 text-[11px] text-zinc-600">
            Type a command below — <span className="text-zinc-500">clear</span> resets output
          </p>
        )}
        {lines.map((line) => (
          <div
            key={line.id}
            className={`group flex gap-2 py-0.5 ${
              line.type === "in"
                ? "text-orange-300"
                : line.type === "err"
                  ? "text-red-400"
                  : line.type === "sys"
                    ? "text-zinc-500"
                    : "text-zinc-300/95"
            }`}
          >
            <span
              className={`w-3 shrink-0 select-none text-[10px] ${
                line.type === "in"
                  ? "text-orange-500"
                  : line.type === "err"
                    ? "text-red-500/80"
                    : "text-zinc-700"
              }`}
            >
              {linePrefix(line.type)}
            </span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{line.text}</span>
          </div>
        ))}
        {running && (
          <div className="forge-terminal-running mt-2 text-[11px] font-medium">
            Executing command…
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className={`relative z-10 shrink-0 border-t px-3 py-2.5 transition ${
          focused
            ? "border-emerald-500/25 bg-black/60 shadow-[inset_0_0_20px_rgba(16,185,129,0.06)]"
            : "border-white/5 bg-black/50"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-mono-forge text-[11px]">
            <span className="text-emerald-400">repopilot</span>
            <span className="text-zinc-600">:</span>
            <span className="text-sky-400/90">{cwdDisplay}</span>
            <span className="text-zinc-600">$</span>
          </span>
          <div className="relative min-w-0 flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                if (running) return;
                setInput(e.target.value);
              }}
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              readOnly={running}
              spellCheck={false}
              autoComplete="off"
              className={`w-full bg-transparent font-mono-forge text-[13px] text-zinc-100 outline-none placeholder:text-zinc-700 ${
                focused ? "[caret-color:#34d399]" : "caret-transparent"
              }`}
              placeholder={running ? "Running…" : "Enter command"}
            />
          </div>
        </div>
        <p className="mt-1.5 hidden text-[10px] text-zinc-700 sm:block">
          ↑↓ history · Enter run · clear resets
        </p>
      </div>
    </div>
  );
}
