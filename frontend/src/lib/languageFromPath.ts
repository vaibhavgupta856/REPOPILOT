const EXT_LANG: Record<string, string> = {
  py: "python",
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  md: "markdown",
  html: "html",
  css: "css",
  scss: "scss",
  yml: "yaml",
  yaml: "yaml",
  xml: "xml",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  ps1: "powershell",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  rb: "ruby",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  toml: "ini",
  ini: "ini",
  env: "ini",
  dockerfile: "dockerfile",
};

export function languageFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  if (base.toLowerCase() === "dockerfile") return "dockerfile";
  const ext = base.includes(".") ? base.split(".").pop()?.toLowerCase() : "";
  return (ext && EXT_LANG[ext]) || "plaintext";
}

export function displayLanguage(path: string): string {
  const lang = languageFromPath(path);
  return lang.charAt(0).toUpperCase() + lang.slice(1);
}
