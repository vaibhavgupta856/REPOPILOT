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
import { FileTree } from "./FileTree";
import { RepoTerminal } from "./RepoTerminal";
import { SplitPane } from "./SplitPane";

interface ForgeIDEProps {
  repoId: string;
  refreshKey?: number;
}

export function ForgeIDE({ repoId, refreshKey = 0 }: ForgeIDEProps) {
  const [files, setFiles] = useState<WorkspaceFileInfo[]>([]);
  const [workspacePath, setWorkspacePath] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileDetail, setFileDetail] = useState<WorkspaceFileDetail | null>(null);
  const [accepted, setAccepted] = useState<Record<string, number[]>>({});
  const [editContent, setEditContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);

  const loadFiles = useCallback(async () => {
    const [list, acc] = await Promise.all([listRepoFiles(repoId), getAcceptedLines(repoId)]);
    setFiles(list.files);
    setWorkspacePath(list.workspace_path);
    setAccepted(acc);
    setSelectedPath((prev) => {
      if (prev && list.files.some((f) => f.path === prev && !f.is_dir)) return prev;
      const changed = list.files.find((f) => f.has_agent_change && !f.is_dir);
      return changed?.path ?? list.files.find((f) => !f.is_dir)?.path ?? null;
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

  const editorPanel = (
    <div className="flex h-full min-h-0 flex-col bg-[#0c0c10]">
      <div className="flex shrink-0 items-center gap-1 border-b border-white/5 bg-black/30 px-2">
        {selectedPath ? (
          <div className="forge-editor-tab forge-editor-tab-active flex items-center gap-2 rounded-t px-3 py-2 text-xs">
            <span className="font-mono-forge truncate text-orange-200">{selectedPath.split("/").pop()}</span>
            {dirty && <span className="h-2 w-2 rounded-full bg-orange-400" title="Unsaved changes" />}
          </div>
        ) : (
          <div className="px-3 py-2 text-xs text-zinc-600">No file open</div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {selectedPath && fileDetail ? (
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
              Select a file from Explorer or ask the agent to create one
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const terminalPanel = (
    <div className="flex h-full min-h-0 flex-col border-t border-white/5">
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-black/40 px-3 py-1">
        <span className="forge-panel-title text-[10px] font-semibold uppercase text-zinc-500">
          Terminal
        </span>
        <button
          type="button"
          onClick={() => setTerminalOpen(false)}
          className="rounded px-1.5 py-0.5 text-[10px] text-zinc-600 transition hover:bg-white/5 hover:text-zinc-300"
          title="Collapse terminal"
        >
          ▼
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <RepoTerminal repoId={repoId} onCommandComplete={() => loadFiles().catch(() => {})} />
      </div>
    </div>
  );

  const collapsedTerminal = (
    <button
      type="button"
      onClick={() => setTerminalOpen(true)}
      className="flex w-full shrink-0 items-center justify-between border-t border-white/5 bg-black/50 px-3 py-1.5 text-left transition hover:bg-black/70"
    >
      <span className="forge-panel-title text-[10px] font-semibold uppercase text-zinc-500">
        Terminal
      </span>
      <span className="text-[10px] text-zinc-600">▲ expand</span>
    </button>
  );

  const centerColumn = (
    <SplitPane
      orientation="vertical"
      initialRatio={0.68}
      minFirst={160}
      minSecond={120}
      secondCollapsed={!terminalOpen}
      collapsedSecond={collapsedTerminal}
      first={editorPanel}
      second={terminalPanel}
      className="h-full"
    />
  );

  return (
    <div className="forge-glass-strong flex h-full min-h-0 flex-col overflow-hidden rounded-2xl shadow-xl shadow-black/30">
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-black/20 px-4 py-2.5">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-400/80">
            Workspace
          </span>
          <p className="font-mono-forge mt-0.5 max-w-md truncate text-[10px] text-zinc-600">
            {workspacePath}
          </p>
        </div>
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
      </div>

      <div className="min-h-0 flex-1">
        <SplitPane
          orientation="horizontal"
          initialRatio={0.22}
          minFirst={160}
          minSecond={280}
          className="h-full"
          first={
            <aside className="flex h-full flex-col overflow-hidden border-r border-white/5 bg-black/25">
              <p className="forge-panel-title shrink-0 border-b border-white/5 px-3 py-2 text-[10px] font-semibold uppercase text-zinc-600">
                Explorer
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <FileTree
                  files={files}
                  selectedPath={selectedPath}
                  onSelectFile={setSelectedPath}
                />
              </div>
            </aside>
          }
          second={centerColumn}
        />
      </div>
    </div>
  );
}
