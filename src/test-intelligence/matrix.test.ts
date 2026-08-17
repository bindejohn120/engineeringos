import { describe, it, expect } from 'vitest';
import { buildProofMatrix, proofSummary } from '../test-intelligence/matrix';

describe('test intelligence', () => {
  it('builds proof matrix linking invariants to tests', () => {
    const matrix = buildProofMatrix(
      [{ id: 'INV-1', statement: 'Orders must be paid', scope: ['order'], tests: [] }],
      [{ id: 'REQ-1', text: 'Process payments' }],
      [{ id: 'GR-1', rule: 'No direct DB access', scope: ['src/client'], verification: ['test'] }],
      [
        { invariantId: 'INV-1', testFile: 'tests/order.spec.ts', testName: 'payment required', kind: 'unit', result: 'pass' },
        { requirementId: 'REQ-1', testFile: 'tests/payment.spec.ts', testName: 'processes payment', kind: 'integration', result: 'pass' },
        { guardrailId: 'GR-1', testFile: 'tests/boundary.spec.ts', testName: 'no direct DB', kind: 'unit', result: 'pass' }
      ]
    );

    expect(matrix.invariants[0].status).toBe('full');
    expect(matrix.invariants[0].coverage).toBe(1);
    expect(matrix.requirements[0].status).toBe('full');
    expect(matrix.guardrails[0].hasVerification).toBe(true);
  });

  it('detects partial coverage', () => {
    const matrix = buildProofMatrix(
      [{ id: 'INV-1', statement: '', scope: ['order'], tests: [] }],
      [],
      [],
      [{ invariantId: 'INV-1', testFile: 't.ts', testName: 't', kind: 'unit', result: 'fail' }]
    );
    expect(matrix.invariants[0].status).toBe('failed');
  });

  it('detects orphaned tests', () => {
    const matrix = buildProofMatrix(
      [], [], [],
      [{ testFile: 'orphan.ts', testName: 'orphan', kind: 'unit' }]
    );
    expect(matrix.orphanedTests).toHaveLength(1);
  });

  it('proofSummary counts correctly', () => {
    const matrix = buildProofMatrix(
      [
        { id: 'INV-1', statement: '', scope: [], tests: [] },
        { id: 'INV-2', statement: '', scope: [], tests: [] }
      ],
      [{ id: 'REQ-1', text: '' }],
      [],
      [
        { invariantId: 'INV-1', testFile: 't1.ts', testName: 't1', kind: 'unit', result: 'pass' }
      ]
    );
    const summary = proofSummary(matrix);
    expect(summary.invariantsFull).toBe(1);
    expect(summary.invariantsNone).toBe(1);
    expect(summary.requirementsUncovered).toBe(1);
  });
});
