import { useEffect, useMemo, useState } from "react";
import type { WorkspaceFileInfo } from "../lib/api";

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  info?: WorkspaceFileInfo;
}

function buildFileTree(files: WorkspaceFileInfo[]): TreeNode[] {
  const root: TreeNode[] = [];

  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const parts = file.path.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const path = parts.slice(0, i + 1).join("/");
      const isLast = i === parts.length - 1;

      let node = current.find((n) => n.name === name);
      if (!node) {
        node = {
          name,
          path,
          isDir: !isLast || file.is_dir,
          children: [],
          info: isLast ? file : undefined,
        };
        current.push(node);
      } else if (isLast) {
        node.info = file;
        if (file.is_dir) node.isDir = true;
      } else {
        node.isDir = true;
      }

      current = node.children;
    }
  }

  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .map((n) => ({ ...n, children: sortNodes(n.children) }))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  return sortNodes(root);
}

function parentPaths(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  const parents: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    parents.push(parts.slice(0, i).join("/"));
  }
  return parents;
}

interface FileTreeProps {
  files: WorkspaceFileInfo[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

export function FileTree({ files, selectedPath, onSelectFile }: FileTreeProps) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!selectedPath) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const p of parentPaths(selectedPath)) {
        next.add(p);
      }
      return next;
    });
  }, [selectedPath]);

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const f of files) {
        if (f.is_dir && !f.path.includes("/")) {
          next.add(f.path);
        }
      }
      return next;
    });
  }, [files]);

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function renderNode(node: TreeNode, depth: number) {
    const isExpanded = expanded.has(node.path);
    const isSelected = !node.isDir && selectedPath === node.path;
    const hasAgentChange = node.info?.has_agent_change && !node.isDir;

    if (node.isDir) {
      return (
        <div key={node.path}>
          <button
            type="button"
            onClick={() => toggle(node.path)}
            title={node.path}
            className="group mb-px flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-[11px] text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <span
              className={`shrink-0 text-[9px] text-zinc-600 transition-transform ${
                isExpanded ? "rotate-90" : ""
              }`}
            >
              ▶
            </span>
            <span className="shrink-0 text-[11px] text-sky-400/80">
              {isExpanded ? "📂" : "📁"}
            </span>
            <span className="truncate font-mono-forge">{node.name}</span>
          </button>
          {isExpanded &&
            node.children.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    return (
      <button
        key={node.path}
        type="button"
        onClick={() => onSelectFile(node.path)}
        title={node.path}
        className={`mb-px flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[11px] transition ${
          isSelected
            ? "bg-orange-500/15 text-orange-200 ring-1 ring-orange-500/25"
            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
        }`}
        style={{ paddingLeft: `${depth * 12 + 22}px` }}
      >
        {hasAgentChange ? (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
        ) : (
          <span className="w-1.5 shrink-0" />
        )}
        <span className="shrink-0 text-[10px] opacity-70">📄</span>
        <span className="truncate font-mono-forge">{node.name}</span>
      </button>
    );
  }

  if (tree.length === 0) {
    return <p className="px-2 text-xs text-zinc-600">No files yet</p>;
  }

  return <div className="py-0.5">{tree.map((node) => renderNode(node, 0))}</div>;
}
