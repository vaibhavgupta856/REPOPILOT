export interface FileSymbol {
  name: string;
  kind: "function" | "class" | "method" | "variable" | "interface" | "type" | "section";
  line: number;
}

const RULES: { kind: FileSymbol["kind"]; pattern: RegExp }[] = [
  { kind: "class", pattern: /^\s*(?:export\s+)?class\s+(\w+)/ },
  { kind: "interface", pattern: /^\s*(?:export\s+)?interface\s+(\w+)/ },
  { kind: "type", pattern: /^\s*(?:export\s+)?type\s+(\w+)/ },
  { kind: "function", pattern: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/ },
  { kind: "function", pattern: /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/ },
  { kind: "function", pattern: /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?function/ },
  { kind: "method", pattern: /^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\S+)?\s*\{/ },
  { kind: "function", pattern: /^\s*def\s+(\w+)\s*\(/ },
  { kind: "class", pattern: /^\s*class\s+(\w+)/ },
  { kind: "section", pattern: /^#{1,6}\s+(.+)/ },
];

export function extractSymbols(content: string, path: string): FileSymbol[] {
  const symbols: FileSymbol[] = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    for (const rule of RULES) {
      const match = line.match(rule.pattern);
      if (!match?.[1]) continue;
      const name = match[1].trim();
      if (name.length < 2) continue;
      symbols.push({ name, kind: rule.kind, line: index + 1 });
      break;
    }
  });

  if (path.endsWith(".md") && symbols.length === 0) {
    lines.forEach((line, index) => {
      const h = line.match(/^#{1,6}\s+(.+)/);
      if (h) symbols.push({ name: h[1].trim(), kind: "section", line: index + 1 });
    });
  }

  return symbols;
}

export function symbolIcon(kind: FileSymbol["kind"]): string {
  switch (kind) {
    case "class":
      return "◆";
    case "interface":
      return "◇";
    case "function":
      return "ƒ";
    case "method":
      return "m";
    case "variable":
      return "x";
    case "type":
      return "T";
    case "section":
      return "#";
    default:
      return "·";
  }
}
