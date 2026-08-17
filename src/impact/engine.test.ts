import { describe, it, expect } from 'vitest';
import { computeImpact, resolveComponentId } from '../impact/engine';
import { fixtureMap, fixtureMentalModel, fixtureGuardrails } from '../test/helpers';

describe('impact engine', () => {
  it('resolves component ids by id and name', () => {
    const map = fixtureMap();
    expect(resolveComponentId(map, 'payment-service')).toBe('payment-service');
    expect(resolveComponentId(map, 'Payment Service')).toBe('payment-service');
    expect(resolveComponentId(map, 'checkout')).toBe('checkout');
    expect(resolveComponentId(map, 'missing')).toBeNull();
  });

  it('flags HIGH impact for payment service with invariants', () => {
    const report = computeImpact({
      target: 'payment-service',
      map: fixtureMap(),
      mentalModel: fixtureMentalModel(),
      guardrails: fixtureGuardrails()
    });
    expect(report.severity).toBe('HIGH');
    expect(report.affectedComponents.map((c) => c.id)).toContain('checkout');
    expect(report.affectedWorkflows).toContain('Checkout');
    expect(report.relevantInvariants.some((i) => i.includes('INV-001'))).toBe(true);
  });

  it('reports LOW for unknown targets', () => {
    const report = computeImpact({
      target: 'nonexistent-thing',
      map: fixtureMap(),
      mentalModel: fixtureMentalModel(),
      guardrails: fixtureGuardrails()
    });
    expect(report.severity).toBe('LOW');
  });

  it('surfaces components matching keywords for non-id targets', () => {
    const report = computeImpact({
      target: 'payment processing',
      map: fixtureMap(),
      mentalModel: fixtureMentalModel(),
      guardrails: fixtureGuardrails()
    });
    expect(report.affectedComponents.some((c) => c.name.includes('Payment'))).toBe(true);
    expect(report.affectedComponents.length).toBeGreaterThan(0);
  });

  it('includes required verification from invariants and guardrails', () => {
    const report = computeImpact({
      target: 'payment-service',
      map: fixtureMap(),
      mentalModel: fixtureMentalModel(),
      guardrails: fixtureGuardrails()
    });
    expect(report.requiredVerification.some((v) => v.includes('INV-001'))).toBe(true);
    expect(report.requiredVerification.length).toBeGreaterThan(0);
  });
});
