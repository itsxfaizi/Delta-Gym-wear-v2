// Static-analysis helpers for the file-level adversarial specs. Not a spec file.
import fs from "node:fs";
import path from "node:path";

export const REPO_ROOT = path.resolve(__dirname, "..");
export const SRC_ROOT = path.join(REPO_ROOT, "src");

export function listFiles(root: string, extensions: readonly string[]): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return listFiles(full, extensions);
    return extensions.includes(path.extname(entry.name)) ? [full] : [];
  });
}

export const sourceFiles = (): string[] => listFiles(SRC_ROOT, [".ts", ".tsx"]);

export const relative = (file: string): string => path.relative(REPO_ROOT, file).split(path.sep).join("/");

/** True when the module's first directive is "use client" (single or double quoted). */
export function isClientModule(source: string): boolean {
  return /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*|\n)*["']use client["']/.test(source);
}

export function importSpecifiers(source: string): string[] {
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  return [...new Set(patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1])))];
}

/** Resolves a local specifier to a file on disk. Bare package specifiers resolve to null. */
export function resolveLocalImport(specifier: string, fromFile: string): string | null {
  const base = specifier.startsWith("@/")
    ? path.join(SRC_ROOT, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(fromFile), specifier)
      : null;
  if (base === null) return null;

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}
