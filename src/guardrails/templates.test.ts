import { describe, it, expect } from 'vitest';
import { GUARDRAIL_TEMPLATES } from './templates';

describe('GUARDRAIL_TEMPLATES', () => {
  it('has entries', () => {
    expect(GUARDRAIL_TEMPLATES.length).toBeGreaterThan(0);
  });

  it('templates have required fields', () => {
    for (const template of GUARDRAIL_TEMPLATES) {
      expect(typeof template.id).toBe('string');
      expect(template.id.length).toBeGreaterThan(0);
      expect(typeof template.name).toBe('string');
      expect(template.name.length).toBeGreaterThan(0);
      expect(typeof template.rule).toBe('string');
      expect(template.rule.length).toBeGreaterThan(0);
      expect(['advisory', 'warning', 'blocking']).toContain(template.severity);
      expect(typeof template.category).toBe('string');
    }
  });

  it('templates cover different categories', () => {
    const categories = new Set(GUARDRAIL_TEMPLATES.map(t => t.category));
    expect(categories.size).toBeGreaterThan(3);
    expect(categories).toContain('security');
    expect(categories).toContain('correctness');
    expect(categories).toContain('architecture');
  });

  it('every template has scope, forbiddenPatterns, enforcement, reason, and verification', () => {
    for (const template of GUARDRAIL_TEMPLATES) {
      expect(Array.isArray(template.scope)).toBe(true);
      expect(template.scope.length).toBeGreaterThan(0);
      expect(Array.isArray(template.forbiddenPatterns)).toBe(true);
      expect(Array.isArray(template.enforcement)).toBe(true);
      expect(template.enforcement.length).toBeGreaterThan(0);
      expect(typeof template.reason).toBe('string');
      expect(template.reason.length).toBeGreaterThan(0);
      expect(Array.isArray(template.verification)).toBe(true);
      expect(template.verification.length).toBeGreaterThan(0);
    }
  });

  it('has unique template IDs', () => {
    const ids = GUARDRAIL_TEMPLATES.map(t => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
