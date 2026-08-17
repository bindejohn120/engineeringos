import { describe, it, expect } from 'vitest';
import { COMPLIANCE_GUARDRAILS } from './compliance';

describe('COMPLIANCE_GUARDRAILS', () => {
  it('has entries for multiple standards', () => {
    const keys = Object.keys(COMPLIANCE_GUARDRAILS);
    expect(keys.length).toBeGreaterThanOrEqual(5);
    expect(keys).toContain('GDPR');
    expect(keys).toContain('PCI_DSS');
    expect(keys).toContain('HIPAA');
    expect(keys).toContain('SOC2');
    expect(keys).toContain('CCPA');
  });

  it('each standard has guardrails with required fields', () => {
    for (const [, guardrails] of Object.entries(COMPLIANCE_GUARDRAILS)) {
      expect(guardrails.length).toBeGreaterThan(0);
      for (const g of guardrails) {
        expect(typeof g.id).toBe('string');
        expect(g.id.length).toBeGreaterThan(0);
        expect(typeof g.name).toBe('string');
        expect(g.name.length).toBeGreaterThan(0);
        expect(typeof g.rule).toBe('string');
        expect(g.rule.length).toBeGreaterThan(0);
        expect(['advisory', 'warning', 'blocking']).toContain(g.severity);
        expect(typeof g.category).toBe('string');
        expect(g.category).toBe('compliance');
        expect(Array.isArray(g.scope)).toBe(true);
        expect(g.scope.length).toBeGreaterThan(0);
        expect(Array.isArray(g.enforcement)).toBe(true);
        expect(typeof g.reason).toBe('string');
        expect(g.reason.length).toBeGreaterThan(0);
        expect(Array.isArray(g.verification)).toBe(true);
        expect(g.verification.length).toBeGreaterThan(0);
      }
    }
  });

  it('covers multiple compliance standards', () => {
    const allIds = Object.values(COMPLIANCE_GUARDRAILS)
      .flat()
      .map(g => g.id);
    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
    expect(allIds.length).toBeGreaterThanOrEqual(15);
  });

  it('GDPR guardrails reference gdpr compliance', () => {
    for (const g of COMPLIANCE_GUARDRAILS.GDPR) {
      expect(g.applicableCompliance).toContain('gdpr');
    }
  });

  it('HIPAA guardrails reference hipaa compliance', () => {
    for (const g of COMPLIANCE_GUARDRAILS.HIPAA) {
      expect(g.applicableCompliance).toContain('hipaa');
    }
  });

  it('all guardrail IDs are unique', () => {
    const allIds = Object.values(COMPLIANCE_GUARDRAILS)
      .flat()
      .map(g => g.id);
    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
  });
});
