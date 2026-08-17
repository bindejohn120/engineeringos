import { describe, it, expect } from 'vitest';
import { createInvariantRegistry, registerInvariant, evaluateCoverage, coverageSummary } from '../invariants/registry';

describe('invariant registry', () => {
  it('registers invariants with auto timestamps', () => {
    const reg = createInvariantRegistry();
    const inv = registerInvariant(reg, {
      id: 'INV-001', statement: 'Orders must be paid', category: 'state',
      severity: 'CRITICAL', scope: ['OrderService'], failureConsequences: 'financial loss',
      enforcement: ['test'], verification: ['test'], tests: [], runtimeChecks: [],
      guardrails: [], status: 'active', confidence: 0.95
    });
    expect(inv.createdAt).toBeDefined();
    expect(inv.updatedAt).toBeDefined();
    expect(reg.invariants).toHaveLength(1);
    expect(reg.coverage).toHaveLength(1);
    expect(reg.coverage[0].proofStatus).toBe('not-proven');
  });

  it('updates existing invariant on re-registration', () => {
    const reg = createInvariantRegistry();
    registerInvariant(reg, { id: 'INV-001', statement: 'v1', category: 'state', severity: 'CRITICAL', scope: [], failureConsequences: '', enforcement: [], verification: [], tests: [], runtimeChecks: [], guardrails: [], status: 'active', confidence: 0.9 });
    registerInvariant(reg, { id: 'INV-001', statement: 'v2', category: 'state', severity: 'CRITICAL', scope: [], failureConsequences: '', enforcement: [], verification: [], tests: [], runtimeChecks: [], guardrails: [], status: 'active', confidence: 0.9 });
    expect(reg.invariants).toHaveLength(1);
    expect(reg.invariants[0].statement).toBe('v2');
  });

  it('evaluates coverage from tests and guardrails', () => {
    const reg = createInvariantRegistry();
    registerInvariant(reg, {
      id: 'INV-001', statement: 'test', category: 'state', severity: 'CRITICAL',
      scope: ['OrderService'], owner: 'order-team', failureConsequences: '', enforcement: ['test', 'static'],
      verification: ['test'], tests: [], runtimeChecks: [], guardrails: ['GR-001'],
      status: 'active', confidence: 0.9
    });

    evaluateCoverage(reg,
      [{ file: 'tests/order.spec.ts', sourceFile: 'src/OrderService.ts', kind: 'unit' }],
      [{ id: 'GR-001', scope: ['OrderService'] }]
    );

    const cov = reg.coverage[0];
    expect(cov.proofStatus).toBe('proven');
    expect(cov.evidence.length).toBeGreaterThan(0);
  });

  it('reports gaps when no tests match', () => {
    const reg = createInvariantRegistry();
    registerInvariant(reg, {
      id: 'INV-001', statement: 'test', category: 'state', severity: 'CRITICAL',
      scope: ['PaymentService'], failureConsequences: '', enforcement: ['test'],
      verification: ['test'], tests: [], runtimeChecks: [], guardrails: [],
      status: 'active', confidence: 0.9
    });

    evaluateCoverage(reg, [], []);
    expect(reg.coverage[0].proofStatus).toBe('not-proven');
    expect(reg.coverage[0].gaps.some(g => g.kind === 'no-test')).toBe(true);
  });

  it('coverageSummary counts correctly', () => {
    const reg = createInvariantRegistry();
    registerInvariant(reg, { id: 'INV-001', statement: '', category: 'state', severity: 'CRITICAL', scope: [], failureConsequences: '', enforcement: [], verification: [], tests: [], runtimeChecks: [], guardrails: [], status: 'active', confidence: 0.9 });
    registerInvariant(reg, { id: 'INV-002', statement: '', category: 'state', severity: 'HIGH', scope: [], failureConsequences: '', enforcement: [], verification: [], tests: [], runtimeChecks: [], guardrails: [], status: 'active', confidence: 0.9 });
    evaluateCoverage(reg, [], []);
    const summary = coverageSummary(reg);
    expect(summary.total).toBe(2);
    expect(summary.notProven).toBe(2);
  });
});
