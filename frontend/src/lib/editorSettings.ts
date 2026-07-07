export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  stickyScroll: boolean;
  autoSave: boolean;
  formatOnSave: boolean;
  lineNumbers: "on" | "off" | "relative";
}

const STORAGE_KEY = "repopilot_editor_settings";

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: true,
  minimap: true,
  stickyScroll: true,
  autoSave: false,
  formatOnSave: true,
  lineNumbers: "on",
};

export function loadEditorSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_EDITOR_SETTINGS };
    return { ...DEFAULT_EDITOR_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_EDITOR_SETTINGS };
  }
}

export function saveEditorSettings(settings: EditorSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
