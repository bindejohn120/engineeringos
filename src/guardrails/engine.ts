import type { CheckResult, Violation, Verdict } from '../core/protocol';

export interface Rule {
  id: string;
  name: string;
  category: RuleCategory;
  scope: string[];
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  statement: string;
  allowedPatterns?: string[];
  forbiddenPatterns?: string[];
  enforcement: string[];
  reason: string;
  verification?: string[];
  owner?: string;
  status: 'accepted' | 'proposed' | 'deprecated';
}

export type RuleCategory =
  | 'structure' | 'dependency' | 'data-access' | 'contract'
  | 'state' | 'security' | 'secret' | 'test' | 'operational' | 'agent';

export interface RuleContext {
  rootPath: string;
  files: string[];
  imports: { from: string; to: string; kind: string; line: number }[];
  symbols: { file: string; name: string; kind: string; line: number }[];
  tests: { file: string; sourceFile?: string; kind: string }[];
  security: { file: string; line: number; kind: string; severity: string; description: string }[];
  contracts: { file: string; type: string; method?: string; path?: string }[];
  dataAccess: { file: string; line: number; kind: string; target: string }[];
}

export type RuleEvaluator = (rule: Rule, ctx: RuleContext) => Violation[];

export const EVALUATORS: Record<RuleCategory, RuleEvaluator> = {
  dependency: evalDependency,
  'data-access': evalDataAccess,
  contract: evalContract,
  secret: evalSecret,
  security: evalSecurity,
  test: evalTest,
  structure: evalStructure,
  state: evalState,
  operational: evalOperational,
  agent: evalAgent
};

export function evaluateRule(rule: Rule, ctx: RuleContext): CheckResult {
  const start = Date.now();
  const evaluator = EVALUATORS[rule.category] ?? (() => []);
  const violations = evaluator(rule, ctx);
  const verdict: Verdict = violations.some(v => v.severity === 'BLOCKING') ? 'BLOCK'
    : violations.length > 0 ? 'WARN'
    : 'PASS';

  return {
    ruleId: rule.id,
    verdict,
    violations,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    evidence: violations.flatMap(v => v.evidence)
  };
}

function evalDependency(rule: Rule, ctx: RuleContext): Violation[] {
  const violations: Violation[] = [];
  const scopeFiles = ctx.files.filter(f => matchesAny(f, rule.scope));
  const forbidden = rule.forbiddenPatterns ?? [];

  for (const imp of ctx.imports) {
    if (!scopeFiles.includes(imp.from)) continue;
    for (const pat of forbidden) {
      if (imp.to.includes(pat)) {
        violations.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: `Forbidden import: "${imp.to}" in ${imp.from}`,
          file: imp.from,
          line: imp.line,
          evidence: [{ type: 'import', location: `${imp.from}:${imp.line}`, description: `imports ${imp.to}`, confidence: 1 }],
          remediation: `Remove import of "${imp.to}" from ${imp.from}. Use the allowed pattern instead.`
        });
      }
    }
  }
  return violations;
}

function evalDataAccess(rule: Rule, ctx: RuleContext): Violation[] {
  const violations: Violation[] = [];
  const scopeFiles = ctx.files.filter(f => matchesAny(f, rule.scope));
  const forbidden = rule.forbiddenPatterns ?? [];

  for (const access of ctx.dataAccess) {
    if (!scopeFiles.includes(access.file)) continue;
    for (const pat of forbidden) {
      if (access.target.includes(pat) || access.file.includes(pat)) {
        violations.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: `Forbidden data access (${access.kind}) on ${access.target} in ${access.file}`,
          file: access.file,
          line: access.line,
          evidence: [{ type: 'file', location: `${access.file}:${access.line}`, description: `${access.kind} ${access.target}`, confidence: 0.9 }],
          remediation: `Move data access out of scope ${rule.scope.join(', ')}.`
        });
      }
    }
  }
  return violations;
}

function evalContract(rule: Rule, ctx: RuleContext): Violation[] {
  const violations: Violation[] = [];
  const scopeFiles = ctx.files.filter(f => matchesAny(f, rule.scope));
  for (const contract of ctx.contracts) {
    if (!scopeFiles.includes(contract.file)) continue;
    if (contract.method && !contract.path) {
      violations.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: `API route ${contract.method} in ${contract.file} missing path definition`,
        file: contract.file,
        evidence: [{ type: 'schema', location: contract.file, description: 'incomplete route', confidence: 0.8 }]
      });
    }
  }
  return violations;
}

function evalSecret(rule: Rule, ctx: RuleContext): Violation[] {
  const violations: Violation[] = [];
  for (const s of ctx.security) {
    if (s.kind === 'secret' || s.kind === 'credential') {
      violations.push({
        ruleId: rule.id,
        severity: 'BLOCKING',
        message: `${s.description} at ${s.file}:${s.line}`,
        file: s.file,
        line: s.line,
        evidence: [{ type: 'file', location: `${s.file}:${s.line}`, description: s.description, confidence: 0.95 }],
        remediation: 'Move secrets to environment variables or a secret manager.',
        unsafeShortcut: 'Suppressing this rule allows credentials in source, risking exposure.'
      });
    }
  }
  return violations;
}

function evalSecurity(rule: Rule, ctx: RuleContext): Violation[] {
  const violations: Violation[] = [];
  for (const s of ctx.security) {
    if (s.severity === 'critical' || s.severity === 'high') {
      violations.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: `${s.description} at ${s.file}:${s.line}`,
        file: s.file,
        line: s.line,
        evidence: [{ type: 'file', location: `${s.file}:${s.line}`, description: s.description, confidence: 0.85 }],
        remediation: `Address ${s.kind} finding: ${s.description}`
      });
    }
  }
  return violations;
}

function evalTest(rule: Rule, ctx: RuleContext): Violation[] {
  const violations: Violation[] = [];
  const scopeFiles = ctx.files.filter(f => matchesAny(f, rule.scope));
  const requiredKinds = rule.forbiddenPatterns ?? ['unit'];

  for (const file of scopeFiles) {
    const fileTests = ctx.tests.filter(t => t.sourceFile === file);
    if (fileTests.length === 0) {
      violations.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: `No tests found for ${file}`,
        file,
        evidence: [{ type: 'test', location: file, description: 'no test coverage', confidence: 1 }],
        remediation: `Add tests for ${file} covering required categories: ${requiredKinds.join(', ')}`
      });
    }
  }
  return violations;
}

function evalStructure(rule: Rule, ctx: RuleContext): Violation[] {
  const violations: Violation[] = [];
  const required = rule.allowedPatterns ?? [];
  for (const pat of required) {
    if (!ctx.files.some(f => f.includes(pat))) {
      violations.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: `Required structure "${pat}" not found in repository`,
        evidence: [{ type: 'analysis', location: '', description: `missing ${pat}`, confidence: 1 }]
      });
    }
  }
  return violations;
}

function evalState(_rule: Rule, _ctx: RuleContext): Violation[] { return []; }
function evalOperational(_rule: Rule, _ctx: RuleContext): Violation[] { return []; }
function evalAgent(_rule: Rule, _ctx: RuleContext): Violation[] { return []; }

function matchesAny(filePath: string, patterns: string[]): boolean {
  return patterns.some(p => {
    if (p.startsWith('!')) return !matchesPattern(filePath, p.slice(1));
    return matchesPattern(filePath, p);
  });
}

function resolveRelative(fromFile: string, importPath: string): string {
  if (!importPath.startsWith('.')) return importPath;
  const fromDir = fromFile.split('/').slice(0, -1).join('/');
  const parts = [...fromDir.split('/'), ...importPath.split('/')];
  const resolved: string[] = [];
  for (const p of parts) {
    if (p === '..') resolved.pop();
    else if (p !== '.') resolved.push(p);
  }
  return resolved.join('/');
}

function matchesPattern(filePath: string, pattern: string): boolean {
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*\*/g, '<<GLOBSTAR>>').replace(/\*/g, '[^/]*').replace(/<<GLOBSTAR>>/g, '.*') + '$');
    return regex.test(filePath);
  }
  return filePath.includes(pattern);
}

export function evaluateAllRules(rules: Rule[], ctx: RuleContext): CheckResult[] {
  return rules
    .filter(r => r.status === 'accepted')
    .map(r => evaluateRule(r, ctx));
}

// ── Backward-compatible wrapper for old GuardrailEngine interface ──

import type { Guardrail, ScannedFile, ImportRecord, GuardrailCheckInput, GuardrailResult, EchoSignal, ValidatorKind } from '../core/types';

export interface GuardrailEngineResult {
  overall: 'PASS' | 'WARN' | 'BLOCK' | 'REVIEW' | 'NOT_VALIDATED';
  results: GuardrailResult[];
  signals: EchoSignal[];
}

export function checkRule(input: GuardrailCheckInput): GuardrailResult {
  const { rule, files, imports, dependencies, validatorKinds } = input;
  const signals: EchoSignal[] = [];
  const scopeFiles = files.filter(f => matchesAny(f.relativePath, rule.scope));

  if (validatorKinds.includes('file-boundary') || validatorKinds.includes('import')) {
    for (const imp of imports) {
      if (!scopeFiles.some(f => f.relativePath === imp.file)) continue;
      const resolvedPath = resolveRelative(imp.file, imp.importPath);
      for (const pat of rule.forbiddenPatterns) {
        if (resolvedPath.includes(pat) || imp.importPath.includes(pat)) {
          signals.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: rule.rule,
            file: imp.file,
            suggestedCorrection: rule.reason
          });
        }
      }
    }
  }

  if (validatorKinds.includes('dependency')) {
    for (const dep of dependencies) {
      for (const pat of rule.forbiddenPatterns) {
        if (dep.includes(pat)) {
          signals.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Forbidden dependency: ${dep}`,
            file: 'package.json'
          });
        }
      }
    }
  }

  if (validatorKinds.includes('pattern')) {
    for (const f of scopeFiles) {
      for (const pat of rule.forbiddenPatterns) {
        const regex = new RegExp(pat);
        if (regex.test(f.content)) {
          signals.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: rule.rule,
            file: f.relativePath
          });
        }
      }
    }
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    status: signals.length > 0 ? (rule.severity === 'blocking' ? 'fail' : 'warn') : 'pass',
    signals
  };
}

export function runGuardrailEngine(input: {
  guardrails: Guardrail[];
  files: ScannedFile[];
  imports: ImportRecord[];
  dependencies: string[];
}): GuardrailEngineResult {
  const results: GuardrailResult[] = [];
  const signals: EchoSignal[] = [];

  for (const g of input.guardrails) {
    const enforceKinds: ValidatorKind[] = (g.enforcement.length > 0 ? g.enforcement : ['import', 'pattern']) as ValidatorKind[];
    const result = checkRule({
      rule: g,
      files: input.files,
      imports: input.imports,
      dependencies: input.dependencies,
      validatorKinds: enforceKinds
    });
    results.push(result);
    signals.push(...result.signals);
  }

  let overall: GuardrailEngineResult['overall'] = 'PASS';
  if (results.some(r => r.status === 'fail')) overall = 'BLOCK';
  else if (results.some(r => r.status === 'warn')) overall = 'REVIEW';

  return { overall, results, signals };
}
