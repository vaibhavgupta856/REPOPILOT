import { useEffect } from "react";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      for (const s of shortcuts) {
        const needsCtrl = s.ctrl ?? false;
        const needsShift = s.shift ?? false;
        const needsAlt = s.alt ?? false;

        if (needsCtrl && !(e.ctrlKey || e.metaKey)) continue;
        if (!needsCtrl && !needsShift && !needsAlt && (e.ctrlKey || e.metaKey)) continue;
        if (e.shiftKey !== needsShift) continue;
        if (e.altKey !== needsAlt) continue;
        if (e.key.toLowerCase() !== s.key.toLowerCase()) continue;

        if (isInput && !needsCtrl && s.key !== "Escape") continue;

        e.preventDefault();
        s.handler();
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts, enabled]);
}
