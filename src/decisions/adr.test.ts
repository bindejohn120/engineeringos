import { describe, it, expect } from 'vitest';
import { createADRRegistry, createADR, acceptADR, supersedeADR, detectADRViolations } from '../decisions/adr';

describe('ADR lifecycle', () => {
  it('creates and accepts an ADR', () => {
    const registry = createADRRegistry();
    const adr = createADR({
      id: 'ADR-001', title: 'Use TypeScript', status: 'proposed',
      context: 'Need type safety', decision: 'Use TypeScript',
      constraints: [], alternatives: [], consequences: [],
      rollbackPlan: 'Revert', affectedModules: [], affectedContracts: [],
      validationCriteria: [], owner: 'platform', tags: [], links: []
    });
    registry.adrs.push(adr);

    const accepted = acceptADR(registry, 'ADR-001', 'tech-lead');
    expect(accepted?.status).toBe('accepted');
    expect(accepted?.approver).toBe('tech-lead');
    expect(accepted?.acceptedAt).toBeDefined();
  });

  it('supersedes an old ADR', () => {
    const registry = createADRRegistry();
    registry.adrs.push(
      createADR({ id: 'ADR-001', title: 'Old decision', status: 'accepted', context: '', decision: '', constraints: [], alternatives: [], consequences: [], rollbackPlan: '', affectedModules: [], affectedContracts: [], validationCriteria: [], owner: 'dev', tags: [], links: [] }),
      createADR({ id: 'ADR-002', title: 'New decision', status: 'proposed', context: '', decision: '', constraints: [], alternatives: [], consequences: [], rollbackPlan: '', affectedModules: [], affectedContracts: [], validationCriteria: [], owner: 'dev', tags: [], links: [] })
    );

    const ok = supersedeADR(registry, 'ADR-001', 'ADR-002');
    expect(ok).toBe(true);
    expect(registry.adrs[0].status).toBe('superseded');
    expect(registry.adrs[0].supersededBy).toBe('ADR-002');
    expect(registry.adrs[1].status).toBe('accepted');
  });

  it('detects missing ADRs for new dependencies', () => {
    const registry = createADRRegistry();
    const violations = detectADRViolations(registry, {
      newExternalDependencies: ['stripe', 'prisma']
    });
    expect(violations.length).toBe(2);
    expect(violations[0].kind).toBe('missing');
    expect(violations[0].severity).toBe('BLOCKING');
  });

  it('does not flag dependencies with accepted ADRs', () => {
    const registry = createADRRegistry();
    registry.adrs.push(
      createADR({ id: 'ADR-001', title: 'Use Stripe', status: 'accepted', context: '', decision: 'Use stripe for payments', constraints: [], alternatives: [], consequences: [], rollbackPlan: '', affectedModules: [], affectedContracts: [], validationCriteria: [], owner: 'dev', tags: [], links: [] })
    );
    const violations = detectADRViolations(registry, {
      newExternalDependencies: ['stripe']
    });
    expect(violations.length).toBe(0);
  });
});
