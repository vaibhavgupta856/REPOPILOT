import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createEditorHandle, monacoOptionsFromSettings, type EditorHandle } from "../lib/editorHandle";
import type { EditorSettings } from "../lib/editorSettings";
import { languageFromPath } from "../lib/languageFromPath";

interface CodeEditorProps {
  path: string;
  value: string;
  changedLines: number[];
  acceptedLines: number[];
  settings: EditorSettings;
  onChange: (value: string) => void;
  onCursorChange?: (line: number, column: number) => void;
}

export const CodeEditor = forwardRef<EditorHandle, CodeEditorProps>(function CodeEditor(
  { path, value, changedLines, acceptedLines, settings, onChange, onCursorChange },
  ref,
) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const decoRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const handleRef = useRef<EditorHandle>(createEditorHandle(() => editorRef.current));

  useImperativeHandle(ref, () => handleRef.current, []);

  const acceptedSet = new Set(acceptedLines);
  const pendingChanges = changedLines.filter((l) => !acceptedSet.has(l));

  function applyDecorations(
    ed: editor.IStandaloneCodeEditor,
    monaco: typeof import("monaco-editor"),
  ) {
    const model = ed.getModel();
    if (!model) return;

    decoRef.current?.clear();

    const decorations = pendingChanges.map((lineIndex) => ({
      range: new monaco.Range(lineIndex + 1, 1, lineIndex + 1, 1),
      options: {
        isWholeLine: true,
        className: "forge-agent-line",
        glyphMarginClassName: "forge-agent-glyph",
        marginClassName: "forge-agent-margin",
      },
    }));

    decoRef.current = ed.createDecorationsCollection(decorations);
  }

  const onMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;

    monaco.editor.defineTheme("repopilot-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6b7280" },
        { token: "string", foreground: "86efac" },
        { token: "keyword", foreground: "c4b5fd" },
      ],
      colors: {
        "editor.background": "#0c0c10",
        "editor.lineHighlightBackground": "#ffffff08",
        "editorGutter.background": "#0a0a0e",
        "editorLineNumber.foreground": "#52525b",
        "editorLineNumber.activeForeground": "#f97316",
        "editor.selectionBackground": "#f9731640",
        "editor.inactiveSelectionBackground": "#f9731620",
        "minimap.background": "#0c0c10",
        "editorStickyScroll.background": "#0a0a0e",
        "editorStickyScrollHover.background": "#ffffff10",
        "scrollbar.shadow": "#00000000",
        "scrollbarSlider.background": "#3a3a4280",
        "scrollbarSlider.hoverBackground": "#52525b",
        "scrollbarSlider.activeBackground": "#71717a",
      },
    });
    monaco.editor.setTheme("repopilot-dark");

    ed.updateOptions(monacoOptionsFromSettings(settings));

    ed.onDidChangeCursorPosition((e) => {
      onCursorChange?.(e.position.lineNumber, e.position.column);
    });

    applyDecorations(ed, monaco);
  };

  useEffect(() => {
    editorRef.current?.updateOptions(monacoOptionsFromSettings(settings));
  }, [settings]);

  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (ed && monaco) applyDecorations(ed, monaco);
  }, [pendingChanges.join(","), path]);

  return (
    <Editor
      key={path}
      height="100%"
      language={languageFromPath(path)}
      value={value}
      theme="repopilot-dark"
      onChange={(v) => onChange(v ?? "")}
      onMount={onMount}
      loading={
        <div className="flex h-full items-center justify-center text-xs text-zinc-600">
          Loading editor…
        </div>
      }
      options={{
        readOnly: false,
        ...monacoOptionsFromSettings(settings),
      }}
    />
  );
});
