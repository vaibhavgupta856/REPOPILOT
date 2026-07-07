import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Orientation = "horizontal" | "vertical";

interface SplitPaneProps {
  orientation: Orientation;
  initialRatio?: number;
  minFirst?: number;
  minSecond?: number;
  first: ReactNode;
  second: ReactNode;
  className?: string;
  /** When true, second pane collapses to a slim header bar */
  secondCollapsed?: boolean;
  collapsedSecond?: ReactNode;
}

export function SplitPane({
  orientation,
  initialRatio = 0.7,
  minFirst = 100,
  minSecond = 100,
  first,
  second,
  className = "",
  secondCollapsed = false,
  collapsedSecond,
}: SplitPaneProps) {
  const [ratio, setRatio] = useState(initialRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const isH = orientation === "horizontal";

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      document.body.style.cursor = isH ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [isH],
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const total = isH ? rect.width : rect.height;
      if (total <= 0) return;

      const pos = isH ? e.clientX - rect.left : e.clientY - rect.top;
      const minFirstR = minFirst / total;
      const maxFirstR = 1 - minSecond / total;
      setRatio(Math.max(minFirstR, Math.min(maxFirstR, pos / total)));
    }

    function onMouseUp() {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isH, minFirst, minSecond]);

  if (secondCollapsed && collapsedSecond) {
    return (
      <div
        ref={containerRef}
        className={`flex min-h-0 min-w-0 ${isH ? "flex-row" : "flex-col"} ${className}`}
      >
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{first}</div>
        {collapsedSecond}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 min-w-0 ${isH ? "flex-row" : "flex-col"} ${className}`}
    >
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={isH ? { width: `${ratio * 100}%` } : { height: `${ratio * 100}%` }}
      >
        {first}
      </div>
      <div
        role="separator"
        aria-orientation={isH ? "vertical" : "horizontal"}
        aria-label="Resize panel"
        onMouseDown={onMouseDown}
        className={`forge-split-handle group relative z-10 shrink-0 ${
          isH
            ? "w-[3px] cursor-col-resize hover:w-[4px]"
            : "h-[3px] cursor-row-resize hover:h-[4px]"
        }`}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{second}</div>
    </div>
  );
}
