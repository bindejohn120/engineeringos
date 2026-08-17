import { describe, it, expect } from 'vitest';
import { buildBlueprint, blueprintSummary } from './engine';
import { safeParseBlueprint, validateBlueprint } from '../core/schemas';

describe('blueprint engine', () => {
  const input = {
    projectName: 'Yam Marketplace',
    projectId: 'yam-marketplace',
    purpose: 'Digital marketplace for yam trading.',
    primaryUsers: ['farmers', 'buyers'],
    criticalCapabilities: ['listing', 'ordering', 'payment'],
    options: { architectureStyle: 'clean-architecture', securityLevel: 'hardened' as const, database: 'postgres' }
  };

  it('builds a comprehensive, schema-valid blueprint', () => {
    const blueprint = buildBlueprint(input);
    expect(blueprint.sections.length).toBeGreaterThanOrEqual(14);
    expect(blueprint.summary).toContain('clean architecture');
    expect(blueprint.securityLevel).toBe('hardened');
    expect(blueprint.techStack.database).toBe('postgres');

    const ids = new Set(blueprint.sections.map((s) => s.id));
    expect(ids.size).toBe(blueprint.sections.length);
    for (const s of blueprint.sections) {
      expect(s.directives.length).toBeGreaterThan(0);
    }

    const parsed = safeParseBlueprint(blueprint);
    expect(parsed.ok).toBe(true);
    expect(validateBlueprint(blueprint).projectName).toBe('Yam Marketplace');
  });

  it('scales security directives with the security level', () => {
    const baseline = buildBlueprint({ ...input, options: { securityLevel: 'baseline' } });
    const regulated = buildBlueprint({ ...input, options: { securityLevel: 'regulated' } });
    const baselineSec = baseline.sections.find((s) => s.id === 'security');
    const regulatedSec = regulated.sections.find((s) => s.id === 'security');
    expect(regulatedSec?.directives.length).toBeGreaterThan(baselineSec?.directives.length ?? 0);
    expect(regulatedSec?.directives.some((d) => /audit log/i.test(d))).toBe(true);
  });

  it('embeds a pasted source spec verbatim', () => {
    const blueprint = buildBlueprint({ ...input, options: { sourceSpec: 'Offline-first. XAF settlement.' } });
    expect(blueprint.sourceSpec).toBe('Offline-first. XAF settlement.');
  });

  it('produces a readable summary', () => {
    const summary = blueprintSummary(buildBlueprint(input));
    expect(summary).toContain('Engineering Blueprint');
    expect(summary).toContain('clean-architecture');
  });
});
