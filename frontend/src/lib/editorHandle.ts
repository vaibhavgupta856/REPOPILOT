import type { editor } from "monaco-editor";
import type { EditorSettings } from "./editorSettings";

export interface EditorHandle {
  getEditor: () => editor.IStandaloneCodeEditor | null;
  formatDocument: () => Promise<void>;
  triggerFind: () => void;
  triggerReplace: () => void;
  goToLine: (line?: number) => void;
  revealLine: (line: number) => void;
}

export function createEditorHandle(
  getEditor: () => editor.IStandaloneCodeEditor | null,
): EditorHandle {
  return {
    getEditor,
    async formatDocument() {
      await getEditor()?.getAction("editor.action.formatDocument")?.run();
    },
    triggerFind() {
      getEditor()?.getAction("editor.action.startFindAction")?.run();
    },
    triggerReplace() {
      getEditor()?.getAction("editor.action.startFindReplaceAction")?.run();
    },
    goToLine(line) {
      const ed = getEditor();
      if (!ed) return;
      if (line != null) {
        ed.setPosition({ lineNumber: line, column: 1 });
        ed.revealLineInCenter(line);
        ed.focus();
        return;
      }
      ed.getAction("editor.action.gotoLine")?.run();
    },
    revealLine(line) {
      const ed = getEditor();
      if (!ed) return;
      ed.setPosition({ lineNumber: line, column: 1 });
      ed.revealLineInCenter(line);
      ed.focus();
    },
  };
}

export function monacoOptionsFromSettings(settings: EditorSettings): editor.IStandaloneEditorConstructionOptions {
  return {
    fontSize: settings.fontSize,
    tabSize: settings.tabSize,
    wordWrap: settings.wordWrap ? "on" : "off",
    minimap: { enabled: settings.minimap },
    stickyScroll: { enabled: settings.stickyScroll },
    lineNumbers: settings.lineNumbers,
    autoClosingBrackets: "always",
    autoClosingQuotes: "always",
    autoClosingOvertype: "always",
    autoIndent: "full",
    formatOnPaste: true,
    formatOnType: true,
    folding: true,
    foldingHighlight: true,
    showFoldingControls: "mouseover",
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    multiCursorModifier: "alt",
    columnSelection: true,
    suggestOnTriggerCharacters: true,
    quickSuggestions: { other: true, comments: false, strings: true },
    parameterHints: { enabled: true },
    hover: { enabled: true },
    links: true,
    colorDecorators: true,
    matchBrackets: "always",
    renderWhitespace: "selection",
    renderLineHighlight: "all",
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    smoothScrolling: true,
    scrollBeyondLastLine: false,
    glyphMargin: true,
    automaticLayout: true,
    fontFamily: "JetBrains Mono, ui-monospace, monospace",
    lineHeight: 22,
    padding: { top: 8 },
    find: {
      addExtraSpaceOnTop: false,
      autoFindInSelection: "never",
      seedSearchStringFromSelection: "always",
    },
  };
}
