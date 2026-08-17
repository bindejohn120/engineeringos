import { describe, it, expect } from 'vitest';
import { mapSchema, mentalModelSchema, guardrailsSchema, configSchema, safeParseMap, safeParseMentalModel } from '../core/schemas';
import { fixtureMap, fixtureMentalModel, fixtureGuardrails } from '../test/helpers';

describe('schemas', () => {
  it('validates a well-formed map', () => {
    const map = fixtureMap();
    const result = safeParseMap(map);
    expect(result.ok).toBe(true);
  });

  it('validates a well-formed mental model', () => {
    const model = fixtureMentalModel();
    const result = safeParseMentalModel(model);
    expect(result.ok).toBe(true);
  });

  it('validates guardrails', () => {
    const parsed = guardrailsSchema.safeParse(fixtureGuardrails());
    expect(parsed.success).toBe(true);
  });

  it('rejects a map with invalid priority', () => {
    const map = fixtureMap();
    const bad = { ...map, requirements: [{ ...map.requirements[0], priority: 'urgent' }] };
    const result = safeParseMap(bad);
    expect(result.ok).toBe(false);
  });

  it('rejects missing required fields', () => {
    const parsed = mapSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it('defaults optional arrays in map', () => {
    const minimal = {
      schemaVersion: '1.0',
      modelVersion: 0,
      project: { name: 'x' }
    };
    const result = mapSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.components).toEqual([]);
    }
  });

  it('rejects invalid severity on invariants', () => {
    const model = fixtureMentalModel();
    const bad = {
      ...model,
      invariants: [{ ...model.invariants[0], severity: 'fatal' }]
    };
    const parsed = mentalModelSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });

  it('validates config', () => {
    const config = {
      schemaVersion: '1.0',
      projectId: 'p',
      projectName: 'P',
      workspacePath: '/tmp/x',
      createdAt: 'now',
      updatedAt: 'now',
      analysis: { enabled: true, watchFiles: true, watchGit: true },
      ai: { provider: 'none', contextMode: 'minimal-relevant' }
    };
    const parsed = configSchema.safeParse(config);
    expect(parsed.success).toBe(true);
  });
});
