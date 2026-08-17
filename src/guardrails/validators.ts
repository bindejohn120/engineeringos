import { matchesAny, toRegex } from '../analyzer/source';
import type { EchoSignal, Guardrail, ImportRecord, ScannedFile } from '../core/types';
import { buildEchoSignal } from './signals';

export interface ValidatorContext {
  rule: Guardrail;
  files: ScannedFile[];
  imports: ImportRecord[];
  dependencies: string[];
  typecheckErrors?: { file: string; message: string }[];
}

export type Validator = (ctx: ValidatorContext) => EchoSignal[];

function scopedFiles(ctx: ValidatorContext): ScannedFile[] {
  return ctx.files.filter((f) => matchesAny(f.relativePath, ctx.rule.scope));
}

function isAllowed(value: string, rule: Guardrail): boolean {
  return rule.allowedPatterns.some((p) => {
    if (p.includes('*')) return toRegex(p).test(value);
    return value.includes(p);
  });
}

export const patternValidator: Validator = (ctx) => {
  const signals: EchoSignal[] = [];
  for (const file of scopedFiles(ctx)) {
    for (const pattern of ctx.rule.forbiddenPatterns) {
      if (isAllowed(pattern, ctx.rule)) continue;
      const re = safeRegex(pattern);
      if (!re) continue;
      const match = re.exec(file.content);
      if (match) {
        signals.push(
          buildEchoSignal(ctx.rule, `Forbidden pattern detected in scoped file.`, file.relativePath, {
            line: lineNumberFor(file.content, match.index)
          })
        );
      }
    }
  }
  return signals;
};

export const importValidator: Validator = (ctx) => {
  const signals: EchoSignal[] = [];
  const scopedPaths = new Set(scopedFiles(ctx).map((f) => f.relativePath));
  for (const record of ctx.imports) {
    if (!scopedPaths.has(record.file)) continue;
    for (const pattern of ctx.rule.forbiddenPatterns) {
      if (isAllowed(record.importPath, ctx.rule)) continue;
      if (matchesImportSpecifier(record.importPath, pattern)) {
        signals.push(
          buildEchoSignal(
            ctx.rule,
            `Forbidden import '${record.importPath}' detected in scoped file.`,
            record.file
          )
        );
      }
    }
  }
  return signals;
};

export const dependencyValidator: Validator = (ctx) => {
  const signals: EchoSignal[] = [];
  for (const pattern of ctx.rule.forbiddenPatterns) {
    for (const dep of ctx.dependencies) {
      if (isAllowed(dep, ctx.rule)) continue;
      if (matchesImportSpecifier(dep, pattern)) {
        signals.push(
          buildEchoSignal(ctx.rule, `Forbidden dependency '${dep}' is declared.`, 'package.json')
        );
      }
    }
  }
  return signals;
};

export const fileBoundaryValidator: Validator = (ctx) => {
  const signals: EchoSignal[] = [];
  const scopedPaths = new Set(scopedFiles(ctx).map((f) => f.relativePath));
  for (const record of ctx.imports) {
    if (!scopedPaths.has(record.file)) continue;
    const target = resolveImportTarget(record.importPath, record.file);
    for (const pattern of ctx.rule.forbiddenPatterns) {
      if (isAllowed(target, ctx.rule)) continue;
      if (matchesImportSpecifier(target, pattern)) {
        signals.push(
          buildEchoSignal(
            ctx.rule,
            `Boundary violation: '${record.file}' imports across an enforced boundary ('${target}').`,
            record.file,
            { expectedBoundary: ctx.rule.verification }
          )
        );
      }
    }
  }
  return signals;
};

export const typescriptValidator: Validator = (ctx) => {
  const signals: EchoSignal[] = [];
  const scopedPaths = new Set(scopedFiles(ctx).map((f) => f.relativePath));
  for (const err of ctx.typecheckErrors ?? []) {
    if (scopedPaths.has(err.file)) {
      signals.push(
        buildEchoSignal(ctx.rule, `TypeScript: ${err.message}`, err.file)
      );
    }
  }
  return signals;
};

export const testValidator: Validator = (ctx) => {
  const signals: EchoSignal[] = [];
  const testFiles = new Set(ctx.files.map((f) => f.relativePath).filter((p) => /\.test\./.test(p)));
  for (const file of scopedFiles(ctx)) {
    const base = file.relativePath.replace(/\.[^.]+$/, '');
    const candidates = [`${base}.test.ts`, `${base}.test.js`, `${file.relativePath}.test.ts`];
    if (!candidates.some((c) => testFiles.has(c))) {
      signals.push(
        buildEchoSignal(
          ctx.rule,
          `Scoped file has no adjacent test file.`,
          file.relativePath
        )
      );
    }
  }
  return signals;
};

export function getValidator(rule: Guardrail): Validator | null {
  const kinds = rule.enforcement;
  if (kinds.includes('pattern') || rule.forbiddenPatterns.some((p) => looksLikeRegex(p))) {
    return patternValidator;
  }
  if (kinds.includes('dependency')) return dependencyValidator;
  if (kinds.includes('import')) return importValidator;
  if (kinds.includes('file-boundary')) return fileBoundaryValidator;
  if (kinds.includes('typescript')) return typescriptValidator;
  if (kinds.includes('test')) return testValidator;
  return null;
}

function looksLikeRegex(pattern: string): boolean {
  return pattern.length > 2 && pattern.startsWith('/');
}

function safeRegex(pattern: string): RegExp | null {
  try {
    if (looksLikeRegex(pattern)) {
      const parts = pattern.split('/');
      const flags = parts.pop() ?? '';
      return new RegExp(parts.slice(1).join('/'), flags);
    }
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
}

function matchesImportSpecifier(importPath: string, pattern: string): boolean {
  const cleaned = pattern.replace(/^['"]|['"]$/g, '');
  if (cleaned.includes('*')) return toRegex(cleaned).test(importPath);
  if (cleaned.endsWith('/') && importPath.startsWith(cleaned)) return true;
  if (importPath === cleaned || importPath.startsWith(cleaned + '/')) return true;
  const segments = importPath.split('/');
  return segments.includes(cleaned);
}

function resolveImportTarget(importPath: string, fromFile: string): string {
  if (!importPath.startsWith('.')) return importPath;
  const dir = fromFile.split('/').slice(0, -1);
  const parts = [...dir, ...importPath.split('/')];
  const out: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      out.pop();
    } else {
      out.push(part);
    }
  }
  return out.join('/');
}

function lineNumberFor(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}
