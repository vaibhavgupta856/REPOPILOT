import { useCallback, useEffect, useMemo, useState } from "react";
import {
  acceptAllLines,
  getAcceptedLines,
  getRepoFile,
  listRepoFiles,
  saveRepoFile,
  type WorkspaceFileDetail,
  type WorkspaceFileInfo,
} from "../lib/api";
import { ActivityBar, type SidebarView } from "./ActivityBar";
import { CodeEditor } from "./CodeEditor";
import { CommandPalette, QuickOpen, type CommandItem } from "./CommandPalette";
import { EditorTabs } from "./EditorTabs";
import { FileTree } from "./FileTree";
import { RepoTerminal } from "./RepoTerminal";
import { SearchPanel } from "./SearchPanel";
import { SplitPane } from "./SplitPane";
import { StatusBar } from "./StatusBar";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

interface ForgeIDEProps {
  repoId: string;
  refreshKey?: number;
}

interface TabState {
  content: string;
  dirty: boolean;
  detail: WorkspaceFileDetail | null;
}

export function ForgeIDE({ repoId, refreshKey = 0 }: ForgeIDEProps) {
  const [files, setFiles] = useState<WorkspaceFileInfo[]>([]);
  const [workspacePath, setWorkspacePath] = useState("");
  const [accepted, setAccepted] = useState<Record<string, number[]>>({});
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [tabState, setTabState] = useState<Record<string, TabState>>({});
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });

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

  const openFile = useCallback(
    async (path: string) => {
      setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
      setSelectedPath(path);

      let alreadyLoaded = false;
      setTabState((prev) => {
        alreadyLoaded = Boolean(prev[path]?.detail);
        return prev;
      });
      if (alreadyLoaded) return;

      try {
        const detail = await getRepoFile(repoId, path);
        setTabState((prev) => ({
          ...prev,
          [path]: { content: detail.current, dirty: false, detail },
        }));
      } catch {
        setTabState((prev) => ({
          ...prev,
          [path]: { content: "", dirty: false, detail: null },
        }));
      }
    },
    [repoId],
  );

  useEffect(() => {
    if (!selectedPath) return;
    getRepoFile(repoId, selectedPath)
      .then((detail) => {
        setTabState((prev) => ({
          ...prev,
          [selectedPath]: {
            content: detail.current,
            dirty: prev[selectedPath]?.dirty ?? false,
            detail,
          },
        }));
      })
      .catch(() => {});
  }, [refreshKey, repoId, selectedPath]);

  useEffect(() => {
    if (selectedPath) openFile(selectedPath).catch(() => {});
  }, [selectedPath, openFile]);

  const activeTab = selectedPath ? tabState[selectedPath] : null;
  const dirtyPaths = useMemo(
    () => new Set(openTabs.filter((p) => tabState[p]?.dirty)),
    [openTabs, tabState],
  );

  async function handleSave() {
    if (!selectedPath || !activeTab) return;
    setSaving(true);
    try {
      await saveRepoFile(repoId, selectedPath, activeTab.content);
      const detail = await getRepoFile(repoId, selectedPath);
      setTabState((prev) => ({
        ...prev,
        [selectedPath]: { content: detail.current, dirty: false, detail },
      }));
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptAll() {
    if (!selectedPath) return;
    const acc = await acceptAllLines(repoId, selectedPath);
    setAccepted(acc);
    await loadFiles();
    const detail = await getRepoFile(repoId, selectedPath);
    setTabState((prev) => ({
      ...prev,
      [selectedPath]: {
        content: detail.current,
        dirty: prev[selectedPath]?.dirty ?? false,
        detail,
      },
    }));
  }

  function closeTab(path: string) {
    setOpenTabs((prev) => prev.filter((p) => p !== path));
    setTabState((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    if (selectedPath === path) {
      const remaining = openTabs.filter((p) => p !== path);
      setSelectedPath(remaining[remaining.length - 1] ?? null);
    }
  }

  function updateContent(value: string) {
    if (!selectedPath) return;
    setTabState((prev) => ({
      ...prev,
      [selectedPath]: {
        ...prev[selectedPath],
        content: value,
        dirty: true,
        detail: prev[selectedPath]?.detail ?? null,
      },
    }));
  }

  const filePaths = useMemo(() => files.filter((f) => !f.is_dir).map((f) => f.path), [files]);

  const commands: CommandItem[] = [
    { id: "save", label: "File: Save", shortcut: "Ctrl+S", run: () => handleSave() },
    { id: "close", label: "File: Close Editor", shortcut: "Ctrl+W", run: () => selectedPath && closeTab(selectedPath) },
    { id: "quick", label: "Go to File…", shortcut: "Ctrl+P", run: () => setQuickOpen(true) },
    { id: "terminal", label: "View: Toggle Terminal", shortcut: "Ctrl+`", run: () => setTerminalOpen((v) => !v) },
    { id: "sidebar", label: "View: Toggle Sidebar", shortcut: "Ctrl+B", run: () => setSidebarOpen((v) => !v) },
    { id: "explorer", label: "View: Show Explorer", run: () => { setSidebarView("explorer"); setSidebarOpen(true); } },
    { id: "search", label: "View: Show Search", run: () => { setSidebarView("search"); setSidebarOpen(true); } },
    { id: "accept", label: "Agent: Accept All Changes", run: () => handleAcceptAll() },
  ];

  useKeyboardShortcuts([
    { key: "s", ctrl: true, handler: () => handleSave() },
    { key: "w", ctrl: true, handler: () => selectedPath && closeTab(selectedPath) },
    { key: "p", ctrl: true, handler: () => setQuickOpen(true) },
    { key: "p", ctrl: true, shift: true, handler: () => setCommandOpen(true) },
    { key: "`", ctrl: true, handler: () => setTerminalOpen((v) => !v) },
    { key: "b", ctrl: true, handler: () => setSidebarOpen((v) => !v) },
  ]);

  const changedSet = new Set(activeTab?.detail?.changed_lines ?? []);

  const editorPanel = (
    <div className="flex h-full min-h-0 flex-col bg-[#0c0c10]">
      <EditorTabs
        tabs={openTabs}
        active={selectedPath}
        dirtyPaths={dirtyPaths}
        onSelect={setSelectedPath}
        onClose={closeTab}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {selectedPath && activeTab?.detail ? (
          <CodeEditor
            path={selectedPath}
            value={activeTab.content}
            changedLines={activeTab.detail.changed_lines}
            acceptedLines={accepted[selectedPath] ?? []}
            onChange={updateContent}
            onCursorChange={(line, column) => setCursor({ line, column })}
          />
        ) : selectedPath ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">Loading file…</div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm text-zinc-500">Open a file from Explorer</p>
            <p className="font-mono-forge text-xs text-zinc-600">
              Ctrl+P go to file · Ctrl+Shift+P commands · Ctrl+` terminal
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const terminalPanel = (
    <div className="flex h-full min-h-0 flex-col border-t border-white/5">
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-black/40 px-3 py-1">
        <span className="forge-panel-title text-[10px] font-semibold uppercase text-zinc-500">Terminal</span>
        <button type="button" onClick={() => setTerminalOpen(false)} className="rounded px-1.5 py-0.5 text-[10px] text-zinc-600 hover:bg-white/5" title="Collapse (Ctrl+`)">▼</button>
      </div>
      <div className="min-h-0 flex-1">
        <RepoTerminal repoId={repoId} onCommandComplete={() => loadFiles().catch(() => {})} />
      </div>
    </div>
  );

  const collapsedTerminal = (
    <button type="button" onClick={() => setTerminalOpen(true)} className="flex w-full shrink-0 items-center justify-between border-t border-white/5 bg-black/50 px-3 py-1.5 text-left hover:bg-black/70">
      <span className="forge-panel-title text-[10px] font-semibold uppercase text-zinc-500">Terminal</span>
      <span className="text-[10px] text-zinc-600">▲ expand</span>
    </button>
  );

  const sidebar = sidebarOpen ? (
    <SplitPane
      orientation="horizontal"
      initialRatio={0.28}
      minFirst={140}
      minSecond={200}
      className="h-full"
      first={
        <aside className="flex h-full min-w-0 flex-col overflow-hidden border-r border-white/5 bg-[#0a0a0e]">
          {sidebarView === "explorer" ? (
            <>
              <p className="forge-panel-title shrink-0 border-b border-white/5 px-3 py-2 text-[10px] font-semibold uppercase text-zinc-600">Explorer</p>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <FileTree files={files} selectedPath={selectedPath} onSelectFile={openFile} />
              </div>
            </>
          ) : (
            <SearchPanel repoId={repoId} files={files} onOpenFile={openFile} />
          )}
        </aside>
      }
      second={editorPanel}
    />
  ) : (
    editorPanel
  );

  const mainArea = (
    <div className="flex h-full min-h-0">
      <ActivityBar
        active={sidebarView}
        sidebarOpen={sidebarOpen}
        onSelect={(view) => { setSidebarView(view); setSidebarOpen(true); }}
        onToggleSidebar={() => setSidebarOpen(false)}
      />
      <div className="min-h-0 min-w-0 flex-1">{sidebar}</div>
    </div>
  );

  return (
    <>
      <div className="forge-glass-strong flex h-full min-h-0 flex-col overflow-hidden rounded-2xl shadow-xl shadow-black/30">
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-black/20 px-4 py-2">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-400/80">Workspace</span>
            <p className="font-mono-forge mt-0.5 max-w-md truncate text-[10px] text-zinc-600">{workspacePath}</p>
          </div>
          <div className="flex gap-2">
            {selectedPath && changedSet.size > 0 && (
              <button type="button" onClick={handleAcceptAll} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20">
                Accept all
              </button>
            )}
            {(dirtyPaths.has(selectedPath ?? "") || saving) && (
              <button type="button" onClick={handleSave} disabled={saving} className="forge-btn-primary rounded-lg px-3 py-1 text-xs disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <SplitPane
            orientation="vertical"
            initialRatio={0.64}
            minFirst={200}
            minSecond={100}
            secondCollapsed={!terminalOpen}
            collapsedSecond={collapsedTerminal}
            className="h-full"
            first={mainArea}
            second={terminalPanel}
          />
        </div>

        <StatusBar path={selectedPath} line={cursor.line} column={cursor.column} dirty={dirtyPaths.has(selectedPath ?? "")} />
      </div>

      <CommandPalette open={commandOpen} commands={commands} onClose={() => setCommandOpen(false)} />
      <QuickOpen open={quickOpen} files={filePaths} onClose={() => setQuickOpen(false)} onOpen={openFile} />
    </>
  );
}
