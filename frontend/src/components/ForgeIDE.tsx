import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  acceptAllLines,
  getAcceptedLines,
  getRepoFile,
  listRepoFiles,
  saveRepoFile,
  type WorkspaceFileDetail,
  type WorkspaceFileInfo,
} from "../lib/api";
import { extractSymbols } from "../lib/extractSymbols";
import type { EditorHandle } from "../lib/editorHandle";
import {
  loadEditorSettings,
  saveEditorSettings,
  type EditorSettings,
} from "../lib/editorSettings";
import { ActivityBar, type SidebarView } from "./ActivityBar";
import { Breadcrumbs } from "./Breadcrumbs";
import { CodeEditor } from "./CodeEditor";
import { CommandPalette, QuickOpen, SymbolQuickOpen, type CommandItem } from "./CommandPalette";
import { EditorSettingsPanel } from "./EditorSettingsPanel";
import { EditorTabs } from "./EditorTabs";
import { FileTree } from "./FileTree";
import { GoToLineDialog } from "./GoToLineDialog";
import { MarkdownPreview } from "./MarkdownPreview";
import { OutlinePanel } from "./OutlinePanel";
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
  const editorRef = useRef<EditorHandle>(null);
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
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [goToLineOpen, setGoToLineOpen] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => loadEditorSettings());
  const [zenMode, setZenMode] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const pendingLineRef = useRef<number | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const [list, acc] = await Promise.all([listRepoFiles(repoId), getAcceptedLines(repoId)]);
      setFilesError(null);
      setFiles(list.files);
      setWorkspacePath(list.workspace_path);
      setAccepted(acc);
      setSelectedPath((prev) => {
        if (prev && list.files.some((f) => f.path === prev && !f.is_dir)) return prev;
        const changed = list.files.find((f) => f.has_agent_change && !f.is_dir);
        return changed?.path ?? list.files.find((f) => !f.is_dir)?.path ?? null;
      });
    } catch (err) {
      setFiles([]);
      setFilesError(
        err instanceof Error
          ? err.message
          : "Could not load files — the server may be waking up. Click refresh or open a new demo.",
      );
    }
  }, [repoId]);

  useEffect(() => {
    loadFiles().catch(() => {});
  }, [loadFiles, refreshKey]);

  const openFile = useCallback(
    async (path: string, line?: number) => {
      if (line) pendingLineRef.current = line;
      setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
      setSelectedPath(path);

      let alreadyLoaded = false;
      setTabState((prev) => {
        alreadyLoaded = Boolean(prev[path]?.detail);
        return prev;
      });
      if (alreadyLoaded) {
        if (line) editorRef.current?.revealLine(line);
        return;
      }

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
        const line = pendingLineRef.current;
        if (line) {
          pendingLineRef.current = null;
          requestAnimationFrame(() => editorRef.current?.revealLine(line));
        }
      })
      .catch(() => {});
  }, [refreshKey, repoId, selectedPath]);

  useEffect(() => {
    if (selectedPath) openFile(selectedPath).catch(() => {});
  }, [selectedPath, openFile]);

  useEffect(() => {
    saveEditorSettings(editorSettings);
  }, [editorSettings]);

  useEffect(() => {
    if (!editorSettings.autoSave) return;
    const id = window.setInterval(() => {
      if (selectedPath && tabState[selectedPath]?.dirty) {
        handleSave().catch(() => {});
      }
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorSettings.autoSave, selectedPath, tabState]);

  const activeTab = selectedPath ? tabState[selectedPath] : null;
  const dirtyPaths = useMemo(
    () => new Set(openTabs.filter((p) => tabState[p]?.dirty)),
    [openTabs, tabState],
  );

  const fileSymbols = useMemo(() => {
    if (!selectedPath || !activeTab) return [];
    return extractSymbols(activeTab.content, selectedPath);
  }, [selectedPath, activeTab?.content]);

  const isMarkdown = selectedPath?.toLowerCase().endsWith(".md") ?? false;

  async function handleSave() {
    if (!selectedPath || !activeTab) return;
    setSaving(true);
    try {
      if (editorSettings.formatOnSave) {
        await editorRef.current?.formatDocument();
        const ed = editorRef.current?.getEditor();
        const formatted = ed?.getValue();
        if (formatted != null) {
          setTabState((prev) => ({
            ...prev,
            [selectedPath]: { ...prev[selectedPath], content: formatted, dirty: true },
          }));
        }
      }
      const content = editorRef.current?.getEditor()?.getValue() ?? activeTab.content;
      await saveRepoFile(repoId, selectedPath, content);
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

  async function handleNewFile() {
    const path = window.prompt("New file path (e.g. src/utils.py):");
    if (!path?.trim()) return;
    const clean = path.trim().replace(/\\/g, "/");
    await saveRepoFile(repoId, clean, "");
    await loadFiles();
    await openFile(clean);
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
    { id: "format", label: "Format Document", shortcut: "Shift+Alt+F", run: () => editorRef.current?.formatDocument() },
    { id: "close", label: "File: Close Editor", shortcut: "Ctrl+W", run: () => selectedPath && closeTab(selectedPath) },
    { id: "new", label: "File: New File", run: () => handleNewFile() },
    { id: "quick", label: "Go to File…", shortcut: "Ctrl+P", run: () => setQuickOpen(true) },
    { id: "symbol", label: "Go to Symbol in File…", shortcut: "Ctrl+Shift+O", run: () => setSymbolOpen(true) },
    { id: "line", label: "Go to Line…", shortcut: "Ctrl+G", run: () => setGoToLineOpen(true) },
    { id: "find", label: "Find", shortcut: "Ctrl+F", run: () => editorRef.current?.triggerFind() },
    { id: "replace", label: "Replace", shortcut: "Ctrl+H", run: () => editorRef.current?.triggerReplace() },
    { id: "terminal", label: "View: Toggle Terminal", shortcut: "Ctrl+`", run: () => setTerminalOpen((v) => !v) },
    { id: "sidebar", label: "View: Toggle Sidebar", shortcut: "Ctrl+B", run: () => setSidebarOpen((v) => !v) },
    { id: "zen", label: "View: Toggle Zen Mode", run: () => setZenMode((v) => !v) },
    { id: "wrap", label: "View: Toggle Word Wrap", run: () => setEditorSettings((s) => ({ ...s, wordWrap: !s.wordWrap })) },
    { id: "minimap", label: "View: Toggle Minimap", run: () => setEditorSettings((s) => ({ ...s, minimap: !s.minimap })) },
    { id: "md", label: "Markdown: Toggle Preview", run: () => setMarkdownPreview((v) => !v) },
    { id: "explorer", label: "View: Show Explorer", run: () => { setSidebarView("explorer"); setSidebarOpen(true); } },
    { id: "search", label: "View: Show Search", run: () => { setSidebarView("search"); setSidebarOpen(true); } },
    { id: "outline", label: "View: Show Outline", run: () => { setSidebarView("outline"); setSidebarOpen(true); } },
    { id: "settings", label: "View: Editor Settings", run: () => { setSidebarView("settings"); setSidebarOpen(true); } },
    { id: "accept", label: "Agent: Accept All Changes", run: () => handleAcceptAll() },
  ];

  useKeyboardShortcuts([
    { key: "s", ctrl: true, handler: () => handleSave() },
    { key: "w", ctrl: true, handler: () => selectedPath && closeTab(selectedPath) },
    { key: "p", ctrl: true, handler: () => setQuickOpen(true) },
    { key: "p", ctrl: true, shift: true, handler: () => setCommandOpen(true) },
    { key: "o", ctrl: true, shift: true, handler: () => setSymbolOpen(true) },
    { key: "g", ctrl: true, handler: () => setGoToLineOpen(true) },
    { key: "`", ctrl: true, handler: () => setTerminalOpen((v) => !v) },
    { key: "b", ctrl: true, handler: () => setSidebarOpen((v) => !v) },
  ]);

  const changedSet = new Set(activeTab?.detail?.changed_lines ?? []);

  const editorContent = (
    <div className="min-h-0 flex-1 overflow-hidden">
      {selectedPath && activeTab?.detail ? (
        markdownPreview && isMarkdown ? (
          <SplitPane
            orientation="horizontal"
            initialRatio={0.5}
            minFirst={200}
            minSecond={200}
            className="h-full"
            first={
              <CodeEditor
                ref={editorRef}
                path={selectedPath}
                value={activeTab.content}
                changedLines={activeTab.detail.changed_lines}
                acceptedLines={accepted[selectedPath] ?? []}
                settings={editorSettings}
                onChange={updateContent}
                onCursorChange={(line, column) => setCursor({ line, column })}
              />
            }
            second={
              <div className="h-full border-l border-white/5 bg-[#0a0a0e]">
                <p className="border-b border-white/5 px-3 py-1 text-[10px] uppercase text-zinc-600">Preview</p>
                <MarkdownPreview content={activeTab.content} />
              </div>
            }
          />
        ) : (
          <CodeEditor
            ref={editorRef}
            path={selectedPath}
            value={activeTab.content}
            changedLines={activeTab.detail.changed_lines}
            acceptedLines={accepted[selectedPath] ?? []}
            settings={editorSettings}
            onChange={updateContent}
            onCursorChange={(line, column) => setCursor({ line, column })}
          />
        )
      ) : selectedPath ? (
        <div className="flex h-full items-center justify-center text-sm text-zinc-600">Loading file…</div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-zinc-500">Open a file from Explorer</p>
          <p className="font-mono-forge text-xs text-zinc-600">
            Ctrl+P file · Ctrl+Shift+P commands · Ctrl+Shift+O symbols · Ctrl+F find
          </p>
        </div>
      )}
    </div>
  );

  const editorPanel = (
    <div className="flex h-full min-h-0 flex-col bg-[#0c0c10]">
      <Breadcrumbs path={selectedPath} />
      <EditorTabs
        tabs={openTabs}
        active={selectedPath}
        dirtyPaths={dirtyPaths}
        onSelect={setSelectedPath}
        onClose={closeTab}
      />
      {editorContent}
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

  const sidebarContent = (
    <aside className="flex h-full min-w-0 flex-col overflow-hidden border-r border-white/5 bg-[#0a0a0e]">
      {sidebarView === "explorer" && (
        <>
          <p className="forge-panel-title shrink-0 border-b border-white/5 px-3 py-2 text-[10px] font-semibold uppercase text-zinc-600">Explorer</p>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <FileTree
              files={files}
              selectedPath={selectedPath}
              onSelectFile={(p) => openFile(p)}
              onNewFile={() => handleNewFile().catch(() => {})}
              onRefresh={() => loadFiles().catch(() => {})}
              emptyMessage={
                filesError ??
                "No files yet — if this is an old workspace, open a fresh demo from the top bar."
              }
            />
          </div>
        </>
      )}
      {sidebarView === "search" && (
        <SearchPanel
          repoId={repoId}
          files={files}
          onOpenFile={(p, line) => openFile(p, line)}
          onRefresh={() => loadFiles().catch(() => {})}
        />
      )}
      {sidebarView === "outline" && (
        <OutlinePanel
          path={selectedPath}
          content={activeTab?.content ?? ""}
          onGoToLine={(line) => editorRef.current?.revealLine(line)}
        />
      )}
      {sidebarView === "settings" && (
        <EditorSettingsPanel settings={editorSettings} onChange={setEditorSettings} />
      )}
    </aside>
  );

  const sidebar = sidebarOpen ? (
    <SplitPane
      orientation="horizontal"
      initialRatio={0.28}
      minFirst={140}
      minSecond={200}
      className="h-full"
      first={sidebarContent}
      second={editorPanel}
    />
  ) : (
    editorPanel
  );

  const mainArea = (
    <div className="flex h-full min-h-0">
      {!zenMode && (
        <ActivityBar
          active={sidebarView}
          sidebarOpen={sidebarOpen}
          onSelect={(view) => { setSidebarView(view); setSidebarOpen(true); }}
          onToggleSidebar={() => setSidebarOpen(false)}
        />
      )}
      <div className="min-h-0 min-w-0 flex-1">{zenMode ? editorPanel : sidebar}</div>
    </div>
  );

  return (
    <>
      <div className={`forge-glass-strong flex h-full min-h-0 flex-col overflow-hidden shadow-xl shadow-black/30 ${zenMode ? "rounded-none" : "rounded-2xl"}`}>
        {!zenMode && (
          <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-black/20 px-4 py-2">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-400/80">Workspace</span>
              <p className="font-mono-forge mt-0.5 max-w-md truncate text-[10px] text-zinc-600">{workspacePath}</p>
            </div>
            <div className="flex gap-2">
              {isMarkdown && (
                <button type="button" onClick={() => setMarkdownPreview((v) => !v)} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-zinc-400 hover:bg-white/5">
                  {markdownPreview ? "Edit" : "Preview"}
                </button>
              )}
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
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {zenMode ? (
            mainArea
          ) : (
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
          )}
        </div>

        {!zenMode && (
          <StatusBar
            path={selectedPath}
            line={cursor.line}
            column={cursor.column}
            dirty={dirtyPaths.has(selectedPath ?? "")}
            tabSize={editorSettings.tabSize}
          />
        )}
      </div>

      <CommandPalette open={commandOpen} commands={commands} onClose={() => setCommandOpen(false)} />
      <QuickOpen open={quickOpen} files={filePaths} onClose={() => setQuickOpen(false)} onOpen={(p) => openFile(p)} />
      <SymbolQuickOpen
        open={symbolOpen}
        symbols={fileSymbols}
        onClose={() => setSymbolOpen(false)}
        onGo={(line) => editorRef.current?.revealLine(line)}
      />
      <GoToLineDialog
        open={goToLineOpen}
        onClose={() => setGoToLineOpen(false)}
        onGo={(line) => editorRef.current?.goToLine(line)}
      />
    </>
  );
}
