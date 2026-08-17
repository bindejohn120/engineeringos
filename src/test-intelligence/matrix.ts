export interface TestRelationship {
  requirementId?: string;
  invariantId?: string;
  guardrailId?: string;
  componentId?: string;
  testFile: string;
  testName: string;
  kind: 'unit' | 'integration' | 'e2e' | 'property' | 'contract' | 'resilience';
  lastRun?: string;
  result?: 'pass' | 'fail' | 'skip' | 'flaky';
}

export interface TestProofMatrix {
  invariants: {
    id: string;
    statement: string;
    tests: TestRelationship[];
    coverage: number;
    status: 'full' | 'partial' | 'none' | 'failed';
  }[];
  requirements: {
    id: string;
    text: string;
    tests: TestRelationship[];
    coverage: number;
    status: 'full' | 'partial' | 'none';
  }[];
  guardrails: {
    id: string;
    rule: string;
    tests: TestRelationship[];
    hasVerification: boolean;
  }[];
  orphanedTests: TestRelationship[];
  staleTests: TestRelationship[];
}

export interface TestEvidenceRecord {
  timestamp: string;
  commitSha: string | null;
  command: string;
  environment: string;
  durationMs: number;
  results: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    flaky: number;
  };
  affectedInvariants: string[];
  evidenceFile?: string;
}

export function buildProofMatrix(
  invariants: { id: string; statement: string; scope: string[]; tests: string[] }[],
  requirements: { id: string; text: string; affectedComponents?: string[] }[],
  guardrails: { id: string; rule: string; verification?: string[]; scope: string[] }[],
  testRelationships: TestRelationship[]
): TestProofMatrix {
  const invResult = invariants.map(inv => {
    const tests = testRelationships.filter(t => t.invariantId === inv.id);
    const allTests = testRelationships.filter(t =>
      inv.scope.some(s => t.testFile.includes(s)) || inv.tests.some(f => t.testFile.includes(f))
    );
    const combined = [...new Set([...tests, ...allTests])];
    const coverage = combined.length > 0 ? (combined.filter(t => t.result === 'pass').length / combined.length) : 0;
    const status: 'full' | 'partial' | 'failed' | 'none' = coverage >= 1 ? 'full' : coverage > 0 ? 'partial' : combined.some(t => t.result === 'fail') ? 'failed' : 'none';
    return { id: inv.id, statement: inv.statement, tests: combined, coverage, status };
  });

  const reqResult = requirements.map(req => {
    const tests = testRelationships.filter(t => t.requirementId === req.id);
    const coverage = tests.length > 0 ? (tests.filter(t => t.result === 'pass').length / tests.length) : 0;
    const status: 'full' | 'partial' | 'none' = coverage >= 1 ? 'full' : coverage > 0 ? 'partial' : 'none';
    return { id: req.id, text: req.text, tests, coverage, status };
  });

  const guardrailResult = guardrails.map(g => ({
    id: g.id,
    rule: g.rule,
    tests: testRelationships.filter(t => t.guardrailId === g.id),
    hasVerification: (g.verification?.length ?? 0) > 0
  }));

  const allMapped = new Set(testRelationships.filter(t => t.invariantId || t.requirementId || t.guardrailId).map(t => t.testFile));
  const orphanedTests = testRelationships.filter(t => !allMapped.has(t.testFile));

  return { invariants: invResult, requirements: reqResult, guardrails: guardrailResult, orphanedTests, staleTests: [] };
}

export function proofSummary(matrix: TestProofMatrix): {
  invariantsFull: number;
  invariantsPartial: number;
  invariantsNone: number;
  invariantsFailed: number;
  requirementsCovered: number;
  requirementsPartial: number;
  requirementsUncovered: number;
  orphanedTests: number;
} {
  return {
    invariantsFull: matrix.invariants.filter(i => i.status === 'full').length,
    invariantsPartial: matrix.invariants.filter(i => i.status === 'partial').length,
    invariantsNone: matrix.invariants.filter(i => i.status === 'none').length,
    invariantsFailed: matrix.invariants.filter(i => i.status === 'failed').length,
    requirementsCovered: matrix.requirements.filter(r => r.status === 'full').length,
    requirementsPartial: matrix.requirements.filter(r => r.status === 'partial').length,
    requirementsUncovered: matrix.requirements.filter(r => r.status === 'none').length,
    orphanedTests: matrix.orphanedTests.length
  };
}
