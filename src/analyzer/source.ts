import * as fsp from 'fs/promises';
import * as path from 'path';
import type { ImportRecord, ScannedFile } from '../core/types';

export interface ScanOptions {
  include: string[];
  exclude?: string[];
}

export function toRegex(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*';
        i++;
      } else {
        out += '[^/\\\\]*';
      }
    } else if (ch === '?') {
      out += '[^/\\\\]';
    } else {
      out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}$`, 'i');
}

export function matchesAny(relativePath: string, patterns: string[]): boolean {
  const normalized = relativePath.split(path.sep).join('/');
  let positive = false;
  for (const p of patterns) {
    const cleaned = p.split(path.sep).join('/').replace(/^\.\//, '');
    if (cleaned.startsWith('!')) {
      if (matchOne(normalized, cleaned.slice(1))) return false;
      continue;
    }
    if (matchOne(normalized, cleaned)) positive = true;
  }
  return positive;
}

function matchOne(normalized: string, cleaned: string): boolean {
  if (cleaned === '**') return true;
  if (cleaned.endsWith('/**')) {
    const prefix = cleaned.replace(/\/\*\*$/, '');
    if (prefix.includes('*')) return toRegex(cleaned).test(normalized);
    return normalized === prefix || normalized.startsWith(prefix + '/');
  }
  if (cleaned.includes('*')) {
    return toRegex(cleaned).test(normalized);
  }
  return normalized === cleaned || normalized.startsWith(cleaned + '/');
}

export function extractImports(content: string): string[] {
  const imports: string[] = [];
  const seen = new Set<string>();

  const add = (spec: string) => {
    if (spec && !seen.has(spec)) {
      seen.add(spec);
      imports.push(spec);
    }
  };

  const fromPattern = /(?:import|export)\s+[^'";]*?\s+from\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = fromPattern.exec(content)) !== null) {
    add(m[1]);
  }

  const barePattern = /\bimport\s*['"]([^'"]+)['"]/g;
  while ((m = barePattern.exec(content)) !== null) {
    add(m[1]);
  }

  const requirePattern = /(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = requirePattern.exec(content)) !== null) {
    add(m[1]);
  }

  return imports;
}

export function isSourceFile(relativePath: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|java|go|rb|php|cs|vue|svelte)$/i.test(relativePath);
}

export async function scanWorkspace(workspacePath: string, options: ScanOptions): Promise<ScannedFile[]> {
  const exclude = options.exclude ?? ['node_modules', 'dist', 'out', '.git', '.engineeringos', 'coverage', '.vscode-test'];
  const results: ScannedFile[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(workspacePath, full).split(path.sep).join('/');
      if (entry.isDirectory()) {
        if (exclude.some((e) => rel === e || rel.startsWith(e + '/'))) continue;
        await walk(full);
      } else if (entry.isFile()) {
        const normalized = rel;
        if (matchesAny(normalized, options.include)) {
          try {
            const content = await fsp.readFile(full, 'utf-8');
            results.push({ path: full, relativePath: normalized, content });
          } catch {
            // skip unreadable files
          }
        }
      }
    }
  }

  await walk(workspacePath);
  return results;
}

export async function buildImportRecords(files: ScannedFile[]): Promise<ImportRecord[]> {
  const records: ImportRecord[] = [];
  for (const file of files) {
    const imports = extractImports(file.content);
    for (const importPath of imports) {
      records.push({ file: file.relativePath, importPath });
    }
  }
  return records;
}

export async function resolveGlobSources(workspacePath: string, patterns: string[]): Promise<string[]> {
  const resolved: string[] = [];
  const files = await scanWorkspace(workspacePath, { include: patterns });
  for (const file of files) {
    resolved.push(file.relativePath);
  }
  return resolved;
}
