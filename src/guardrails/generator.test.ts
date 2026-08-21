import { describe, it, expect } from 'vitest';
import { generateContextualGuardrails } from './generator';
import type { Guardrail } from '../core/types';

describe('generateContextualGuardrails', () => {
  it('returns guardrails for NestJS+Prisma', () => {
    const result = generateContextualGuardrails({
      frameworks: ['nestjs'],
      databases: ['prisma'],
      domains: [],
      compliance: [],
      existingGuardrails: [],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(g =>
      g.name.toLowerCase().includes('nestjs') || g.name.toLowerCase().includes('prisma'),
    )).toBe(true);
  });

  it('filters by framework', () => {
    const nestResult = generateContextualGuardrails({
      frameworks: ['nestjs'],
      databases: [],
      domains: [],
      compliance: [],
      existingGuardrails: [],
    });
    const expressResult = generateContextualGuardrails({
      frameworks: ['express'],
      databases: [],
      domains: [],
      compliance: [],
      existingGuardrails: [],
    });
    const nestNames = nestResult.map(g => g.name);
    const expressNames = expressResult.map(g => g.name);
    expect(nestNames).not.toEqual(expressNames);
  });

  it('deduplicates results', () => {
    const result = generateContextualGuardrails({
      frameworks: ['nestjs'],
      databases: ['prisma'],
      domains: ['payment'],
      compliance: ['gdpr'],
      existingGuardrails: [],
    });
    const names = result.map(g => g.name);
    const unique = new Set(names.map(n => n.toLowerCase()));
    expect(unique.size).toBe(names.length);
  });

  it('limits to 40 guardrails max', () => {
    const result = generateContextualGuardrails({
      frameworks: ['nestjs', 'express', 'nextjs'],
      databases: ['prisma', 'postgresql', 'mysql'],
      domains: ['payment', 'auth', 'inventory', 'notification'],
      compliance: ['gdpr', 'pci', 'hipaa', 'soc2', 'ccpa'],
      existingGuardrails: [],
      maxGuardrails: 40,
    });
    expect(result.length).toBeLessThanOrEqual(40);
  });

  it('respects custom maxGuardrails', () => {
    const result = generateContextualGuardrails({
      frameworks: ['nestjs'],
      databases: ['prisma'],
      domains: [],
      compliance: [],
      existingGuardrails: [],
      maxGuardrails: 5,
    });
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('filters out duplicates against existing guardrails', () => {
    const existing: Guardrail[] = [
      {
        id: 'tpl-nestjs-controller-di',
        name: 'NestJS: Controller dependency rule',
        rule: 'rule',
        severity: 'blocking',
        scope: [],
        allowedPatterns: [],
        forbiddenPatterns: [],
        enforcement: [],
        reason: '',
        verification: [],
      },
    ];
    const result = generateContextualGuardrails({
      frameworks: ['nestjs'],
      databases: [],
      domains: [],
      compliance: [],
      existingGuardrails: existing,
    });
    expect(result.every(g => g.id !== 'tpl-nestjs-controller-di')).toBe(true);
  });

  it('returns Guardrail-shaped objects', () => {
    const result = generateContextualGuardrails({
      frameworks: ['nestjs'],
      databases: [],
      domains: [],
      compliance: [],
      existingGuardrails: [],
    });
    for (const g of result) {
      expect(typeof g.id).toBe('string');
      expect(typeof g.name).toBe('string');
      expect(typeof g.rule).toBe('string');
      expect(['advisory', 'warning', 'blocking']).toContain(g.severity);
      expect(Array.isArray(g.scope)).toBe(true);
      expect(Array.isArray(g.enforcement)).toBe(true);
      expect(Array.isArray(g.verification)).toBe(true);
      expect(typeof g.reason).toBe('string');
    }
  });

  it('filters by language — TypeScript includes React templates', () => {
    const withTs = generateContextualGuardrails({
      frameworks: ['react'],
      databases: [],
      domains: [],
      compliance: [],
      existingGuardrails: [],
      languages: ['typescript'],
    });
    const withPython = generateContextualGuardrails({
      frameworks: ['react'],
      databases: [],
      domains: [],
      compliance: [],
      existingGuardrails: [],
      languages: ['python'],
    });
    expect(withTs.some(g => g.id === 'tpl-react-no-direct-dom')).toBe(true);
    expect(withPython.some(g => g.id === 'tpl-react-no-direct-dom')).toBe(false);
  });

  it('filters by runtime — Docker templates only appear with docker runtime', () => {
    const withDocker = generateContextualGuardrails({
      frameworks: [],
      databases: [],
      domains: [],
      compliance: [],
      existingGuardrails: [],
      runtime: ['docker'],
    });
    const withoutDocker = generateContextualGuardrails({
      frameworks: [],
      databases: [],
      domains: [],
      compliance: [],
      existingGuardrails: [],
      runtime: ['node'],
    });
    expect(withDocker.some(g => g.id === 'tpl-docker-no-root')).toBe(true);
    expect(withoutDocker.some(g => g.id === 'tpl-docker-no-root')).toBe(false);
  });

  it('filters by runtime — React Native templates only appear with react-native runtime', () => {
    const withRN = generateContextualGuardrails({
      frameworks: ['react-native'],
      databases: [],
      domains: [],
      compliance: [],
      existingGuardrails: [],
      runtime: ['react-native'],
      languages: ['typescript'],
    });
    const withoutRN = generateContextualGuardrails({
      frameworks: ['react-native'],
      databases: [],
      domains: [],
      compliance: [],
      existingGuardrails: [],
      runtime: ['node'],
      languages: ['typescript'],
    });
    expect(withRN.some(g => g.id === 'tpl-rn-flatlist-key')).toBe(true);
    expect(withoutRN.some(g => g.id === 'tpl-rn-flatlist-key')).toBe(false);
  });

  it('omits language/runtime filtering when not provided', () => {
    const base = generateContextualGuardrails({
      frameworks: ['react'],
      databases: [],
      domains: [],
      compliance: [],
      existingGuardrails: [],
    });
    const withLang = generateContextualGuardrails({
      frameworks: ['react'],
      databases: [],
      domains: [],
      compliance: [],
      existingGuardrails: [],
      languages: ['typescript'],
    });
    expect(base.some(g => g.id === 'tpl-react-no-direct-dom')).toBe(true);
    expect(withLang.some(g => g.id === 'tpl-react-no-direct-dom')).toBe(true);
  });
});
