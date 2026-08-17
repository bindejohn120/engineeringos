export type InvariantCategory = 'state' | 'security' | 'data' | 'contract' | 'api' | 'business' | 'infrastructure' | 'custom';
export type ProofStatus = 'proven' | 'partially-proven' | 'not-proven' | 'failed' | 'stale';
export type EnforcementType = 'static' | 'runtime' | 'test' | 'ci' | 'manual';

export interface Invariant {
  id: string;
  statement: string;
  category: InvariantCategory;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  scope: string[];
  owner?: string;
  failureConsequences: string;
  enforcement: EnforcementType[];
  verification: string[];
  tests: string[];
  runtimeChecks: string[];
  guardrails: string[];
  status: 'active' | 'deprecated' | 'proposed';
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvariantCoverage {
  invariantId: string;
  proofStatus: ProofStatus;
  evidence: CoverageEvidence[];
  gaps: CoverageGap[];
  lastValidated: string;
  validationRuns: ValidationRun[];
}

export interface CoverageEvidence {
  type: 'test' | 'guardrail' | 'runtime' | 'static-analysis' | 'manual';
  location: string;
  description: string;
  confidence: number;
  lastRun?: string;
  result?: 'pass' | 'fail' | 'skip';
}

export interface CoverageGap {
  kind: 'no-test' | 'stale-test' | 'no-enforcement' | 'no-runtime-check' | 'no-owner';
  description: string;
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  remediation: string;
}

export interface ValidationRun {
  timestamp: string;
  commitSha: string | null;
  result: 'pass' | 'fail' | 'error';
  durationMs: number;
  evidence: CoverageEvidence[];
}

export interface InvariantRegistry {
  schemaVersion: string;
  invariants: Invariant[];
  coverage: InvariantCoverage[];
  lastUpdated: string;
}

export function createInvariantRegistry(): InvariantRegistry {
  return {
    schemaVersion: '1.0',
    invariants: [],
    coverage: [],
    lastUpdated: new Date().toISOString()
  };
}

export function registerInvariant(
  registry: InvariantRegistry,
  invariant: Omit<Invariant, 'createdAt' | 'updatedAt'>
): Invariant {
  const now = new Date().toISOString();
  const existing = registry.invariants.find(i => i.id === invariant.id);
  if (existing) {
    Object.assign(existing, invariant, { updatedAt: now });
    return existing;
  }
  const full: Invariant = { ...invariant, createdAt: now, updatedAt: now };
  registry.invariants.push(full);
  registry.coverage.push({
    invariantId: full.id,
    proofStatus: 'not-proven',
    evidence: [],
    gaps: [{ kind: 'no-test', description: 'No evidence collected', severity: 'WARNING', remediation: 'Add tests and enforcement' }],
    lastValidated: '',
    validationRuns: []
  });
  registry.lastUpdated = now;
  return full;
}

export function evaluateCoverage(
  registry: InvariantRegistry,
  tests: { file: string; sourceFile?: string; kind: string }[],
  guardrails: { id: string; scope: string[] }[]
): InvariantCoverage[] {
  const results: InvariantCoverage[] = [];

  for (const inv of registry.invariants) {
    const evidence: CoverageEvidence[] = [];
    const gaps: CoverageGap[] = [];

    const matchingTests = tests.filter(t =>
      inv.scope.some(s => t.file.includes(s) || t.sourceFile?.includes(s))
    );
    for (const t of matchingTests) {
      evidence.push({
        type: 'test',
        location: t.file,
        description: t.kind + ' test',
        confidence: 0.8,
        result: 'pass'
      });
    }
    if (matchingTests.length === 0 && inv.verification.includes('test')) {
      gaps.push({
        kind: 'no-test',
        description: `Invariant ${inv.id} has no matching tests`,
        severity: inv.severity === 'CRITICAL' ? 'BLOCKING' : 'WARNING',
        remediation: `Add tests covering invariant ${inv.id}: ${inv.statement}`
      });
    }

    const matchingGuardrails = guardrails.filter(g =>
      inv.guardrails.includes(g.id) || inv.scope.some(s => g.scope.some(gs => s.includes(gs)))
    );
    for (const g of matchingGuardrails) {
      evidence.push({
        type: 'guardrail',
        location: g.id,
        description: `Guardrail ${g.id} enforcement`,
        confidence: 0.9,
        result: 'pass'
      });
    }
    if (matchingGuardrails.length === 0 && inv.enforcement.includes('static')) {
      gaps.push({
        kind: 'no-enforcement',
        description: `Invariant ${inv.id} requires static enforcement but no matching guardrail found`,
        severity: 'WARNING',
        remediation: `Add a guardrail for invariant ${inv.id}`
      });
    }

    if (!inv.owner) {
      gaps.push({
        kind: 'no-owner',
        description: `Invariant ${inv.id} has no owner assigned`,
        severity: 'INFO',
        remediation: `Assign an owner to invariant ${inv.id}`
      });
    }

    const proofStatus: ProofStatus = gaps.some(g => g.severity === 'BLOCKING') ? 'not-proven'
      : evidence.length === 0 ? 'not-proven'
      : gaps.length > 0 ? 'partially-proven'
      : 'proven';

    const existing = registry.coverage.find(c => c.invariantId === inv.id);
    const result: InvariantCoverage = {
      invariantId: inv.id,
      proofStatus,
      evidence,
      gaps,
      lastValidated: new Date().toISOString(),
      validationRuns: existing?.validationRuns ?? []
    };
    results.push(result);
  }

  registry.coverage = results;
  registry.lastUpdated = new Date().toISOString();
  return results;
}

export function coverageSummary(registry: InvariantRegistry): {
  total: number;
  proven: number;
  partiallyProven: number;
  notProven: number;
  failed: number;
  blockingGaps: number;
} {
  const total = registry.invariants.length;
  let proven = 0, partiallyProven = 0, notProven = 0, failed = 0, blockingGaps = 0;
  for (const c of registry.coverage) {
    switch (c.proofStatus) {
      case 'proven': proven++; break;
      case 'partially-proven': partiallyProven++; break;
      case 'not-proven': notProven++; break;
      case 'failed': failed++; break;
    }
    blockingGaps += c.gaps.filter(g => g.severity === 'BLOCKING').length;
  }
  return { total, proven, partiallyProven, notProven, failed, blockingGaps };
}
