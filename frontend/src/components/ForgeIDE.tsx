import { useCallback, useEffect, useState } from "react";
import {
  acceptAllLines,
  acceptLines,
  getAcceptedLines,
  getRepoFile,
  listRepoFiles,
  saveRepoFile,
  type WorkspaceFileDetail,
  type WorkspaceFileInfo,
} from "../lib/api";
import { RepoTerminal } from "./RepoTerminal";

interface ForgeIDEProps {
  repoId: string;
  refreshKey?: number;
}

type PanelTab = "editor" | "terminal";

export function ForgeIDE({ repoId, refreshKey = 0 }: ForgeIDEProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("editor");
  const [files, setFiles] = useState<WorkspaceFileInfo[]>([]);
  const [workspacePath, setWorkspacePath] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileDetail, setFileDetail] = useState<WorkspaceFileDetail | null>(null);
  const [accepted, setAccepted] = useState<Record<string, number[]>>({});
  const [editContent, setEditContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadFiles = useCallback(async () => {
    const [list, acc] = await Promise.all([listRepoFiles(repoId), getAcceptedLines(repoId)]);
    setFiles(list.files);
    setWorkspacePath(list.workspace_path);
    setAccepted(acc);
    setSelectedPath((prev) => {
      if (prev && list.files.some((f) => f.path === prev)) return prev;
      const changed = list.files.find((f) => f.has_agent_change);
      return changed?.path ?? list.files[0]?.path ?? null;
    });
  }, [repoId]);

  useEffect(() => {
    loadFiles().catch(() => {});
  }, [loadFiles, refreshKey]);

  useEffect(() => {
    if (!selectedPath) return;
    getRepoFile(repoId, selectedPath)
      .then((detail) => {
        setFileDetail(detail);
        setEditContent(detail.current);
        setDirty(false);
      })
      .catch(() => {
        setFileDetail(null);
        setEditContent("");
      });
  }, [repoId, selectedPath, refreshKey]);

  async function handleSave() {
    if (!selectedPath) return;
    setSaving(true);
    try {
      await saveRepoFile(repoId, selectedPath, editContent);
      setDirty(false);
      const detail = await getRepoFile(repoId, selectedPath);
      setFileDetail(detail);
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptLine(lineIndex: number) {
    if (!selectedPath) return;
    const acc = await acceptLines(repoId, selectedPath, [lineIndex]);
    setAccepted(acc);
  }

  async function handleAcceptAll() {
    if (!selectedPath) return;
    const acc = await acceptAllLines(repoId, selectedPath);
    setAccepted(acc);
    await loadFiles();
    const detail = await getRepoFile(repoId, selectedPath);
    setFileDetail(detail);
  }

  const changedSet = new Set(fileDetail?.changed_lines ?? []);
  const acceptedSet = new Set(selectedPath ? (accepted[selectedPath] ?? []) : []);
  const displayLines = editContent.split("\n");

  return (
    <div className="forge-glass-strong flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl shadow-xl shadow-black/30">
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-black/20 px-4 py-2.5">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-400/80">
            Workspace
          </span>
          <p className="font-mono-forge mt-0.5 max-w-md truncate text-[10px] text-zinc-600">
            {workspacePath}
          </p>
        </div>
        {activeTab === "editor" && (
          <div className="flex gap-2">
            {selectedPath && changedSet.size > 0 && (
              <button
                type="button"
                onClick={handleAcceptAll}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
              >
                Accept all
              </button>
            )}
            {dirty && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="forge-btn-primary rounded-lg px-3 py-1 text-xs disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="w-48 shrink-0 overflow-y-auto border-r border-white/5 bg-black/25 p-2">
          <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Files
          </p>
          {files.length === 0 && (
            <p className="px-2 text-xs text-zinc-600">No files yet</p>
          )}
          {files.map((f) => (
            <button
              key={f.path}
              type="button"
              onClick={() => {
                setSelectedPath(f.path);
                setActiveTab("editor");
              }}
              title={f.path}
              className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition ${
                selectedPath === f.path && activeTab === "editor"
                  ? "bg-orange-500/15 text-orange-200 ring-1 ring-orange-500/25"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {f.has_agent_change && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
              )}
              <span className="truncate font-mono-forge">{f.path.split("/").pop()}</span>
            </button>
          ))}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 gap-1 border-b border-white/5 bg-black/30 px-2 pt-2">
            {(
              [
                { id: "editor" as const, label: "Editor" },
                { id: "terminal" as const, label: "Terminal" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-t-lg px-4 py-1.5 text-xs font-medium transition ${
                  activeTab === tab.id
                    ? "bg-[#0c0c10] text-orange-300 ring-1 ring-inset ring-white/10"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden bg-[#0c0c10]">
            {activeTab === "terminal" ? (
              <RepoTerminal repoId={repoId} onCommandComplete={() => loadFiles().catch(() => {})} />
            ) : selectedPath && fileDetail ? (
              <div className="h-full overflow-auto font-mono-forge text-[13px] leading-relaxed">
                <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/5 bg-zinc-900/90 px-4 py-2 text-xs backdrop-blur-sm">
                  <span className="text-zinc-400">{selectedPath}</span>
                  {fileDetail.action && (
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-400">
                      {fileDetail.action}
                    </span>
                  )}
                </div>
                {displayLines.map((line, i) => {
                  const isAgentChange = changedSet.has(i) && !acceptedSet.has(i);
                  const isAccepted = changedSet.has(i) && acceptedSet.has(i);
                  return (
                    <div
                      key={i}
                      className={`group flex min-h-[1.6rem] items-stretch ${
                        isAgentChange
                          ? "border-l-2 border-l-emerald-400 bg-emerald-950/40"
                          : isAccepted
                            ? "bg-white/[0.02]"
                            : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <span className="w-10 shrink-0 select-none border-r border-white/5 py-0.5 pr-2 text-right text-[10px] text-zinc-600">
                        {i + 1}
                      </span>
                      {isAgentChange && (
                        <button
                          type="button"
                          title="Accept line"
                          onClick={() => handleAcceptLine(i)}
                          className="shrink-0 px-1 text-emerald-400 opacity-0 transition group-hover:opacity-100"
                        >
                          ✓
                        </button>
                      )}
                      <input
                        type="text"
                        value={line}
                        spellCheck={false}
                        onChange={(e) => {
                          const next = [...displayLines];
                          next[i] = e.target.value;
                          setEditContent(next.join("\n"));
                          setDirty(true);
                        }}
                        className={`min-w-0 flex-1 bg-transparent px-2 py-0.5 text-zinc-200 outline-none ${
                          isAgentChange ? "text-emerald-100" : ""
                        }`}
                      />
                    </div>
                  );
                })}
                {displayLines.length === 0 && (
                  <p className="p-8 text-center text-sm text-zinc-600">
                    Empty file — start typing, then Save
                  </p>
                )}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
                <div className="forge-glass rounded-2xl px-6 py-4 font-mono-forge text-xs text-zinc-600">
                  ./src
                </div>
                <p className="text-sm text-zinc-500">
                  Select a file, open the Terminal tab, or ask the agent to create one
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
