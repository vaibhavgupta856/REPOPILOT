import type { EditorSettings } from "../lib/editorSettings";

interface EditorSettingsPanelProps {
  settings: EditorSettings;
  onChange: (settings: EditorSettings) => void;
}

export function EditorSettingsPanel({ settings, onChange }: EditorSettingsPanelProps) {
  function patch(partial: Partial<EditorSettings>) {
    onChange({ ...settings, ...partial });
  }

  return (
    <div className="flex h-full flex-col">
      <p className="forge-panel-title shrink-0 border-b border-white/5 px-3 py-2 text-[10px] font-semibold uppercase text-zinc-600">
        Editor Settings
      </p>
      <div className="space-y-3 overflow-y-auto p-3 text-xs text-zinc-400">
        <label className="flex items-center justify-between gap-2">
          <span>Font size</span>
          <input
            type="number"
            min={10}
            max={24}
            value={settings.fontSize}
            onChange={(e) => patch({ fontSize: Number(e.target.value) || 13 })}
            className="forge-input w-16 rounded px-2 py-1 text-right text-[11px]"
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span>Tab size</span>
          <input
            type="number"
            min={2}
            max={8}
            value={settings.tabSize}
            onChange={(e) => patch({ tabSize: Number(e.target.value) || 2 })}
            className="forge-input w-16 rounded px-2 py-1 text-right text-[11px]"
          />
        </label>
        <Toggle label="Word wrap" checked={settings.wordWrap} onChange={(v) => patch({ wordWrap: v })} />
        <Toggle label="Minimap" checked={settings.minimap} onChange={(v) => patch({ minimap: v })} />
        <Toggle
          label="Sticky scroll"
          checked={settings.stickyScroll}
          onChange={(v) => patch({ stickyScroll: v })}
        />
        <Toggle label="Auto save" checked={settings.autoSave} onChange={(v) => patch({ autoSave: v })} />
        <Toggle
          label="Format on save"
          checked={settings.formatOnSave}
          onChange={(v) => patch({ formatOnSave: v })}
        />
        <p className="border-t border-white/5 pt-3 text-[10px] leading-relaxed text-zinc-600">
          Built-in: multi-cursor (Alt+click), column select (Shift+Alt+drag), find (Ctrl+F), replace
          (Ctrl+H), rename (F2), fold regions, bracket colorization, IntelliSense.
        </p>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-zinc-600 bg-zinc-900 text-orange-500"
      />
    </label>
  );
}
