import { describe, it, expect } from 'vitest';
import { detectDrift } from '../drift/engine';
import { runGuardrailEngine } from '../guardrails/engine';
import { fixtureMap, fixtureMentalModel, fixtureGuardrails } from '../test/helpers';

describe('drift engine', () => {
  it('detects model-to-code drift when source locations resolve to nothing', () => {
    const map = fixtureMap();
    const drift = detectDrift({
      map,
      mentalModel: fixtureMentalModel(),
      files: ['src/client/checkout.ts'],
      guardrailResults: []
    });
    expect(drift.findings.some((f) => f.driftType === 'model-to-code')).toBe(true);
  });

  it('detects code-to-model drift for unmapped files', () => {
    const map = fixtureMap();
    const drift = detectDrift({
      map,
      mentalModel: fixtureMentalModel(),
      files: ['src/client/checkout.ts', 'src/services/payment.ts', 'src/services/order.ts', 'src/secret/hidden.ts'],
      guardrailResults: []
    });
    expect(drift.findings.some((f) => f.driftType === 'code-to-model' && f.evidence.includes('src/secret/hidden.ts'))).toBe(true);
  });

  it('detects requirement-to-implementation drift for open requirements without evidence', () => {
    const map = fixtureMap();
    const drift = detectDrift({
      map,
      mentalModel: fixtureMentalModel(),
      files: ['src/services/payment.ts'],
      guardrailResults: []
    });
    expect(drift.findings.some((f) => f.driftType === 'requirement-to-implementation' && f.title.includes('REQ-001'))).toBe(true);
  });

  it('detects guardrail-to-code drift from failing guardrail results', () => {
    const g = fixtureGuardrails();
    const engine = runGuardrailEngine({
      guardrails: g.guardrails,
      files: [{ path: 'src/client/app.ts', relativePath: 'src/client/app.ts', content: "import { db } from '../db';" }],
      imports: [{ file: 'src/client/app.ts', importPath: '../db' }],
      dependencies: []
    });
    const drift = detectDrift({
      map: fixtureMap(),
      mentalModel: fixtureMentalModel(),
      files: ['src/client/app.ts'],
      guardrailResults: engine.results
    });
    expect(drift.findings.some((f) => f.driftType === 'guardrail-to-code')).toBe(true);
  });

  it('builds an update proposal from findings', () => {
    const drift = detectDrift({
      map: fixtureMap(),
      mentalModel: fixtureMentalModel(),
      files: ['src/services/payment.ts'],
      guardrailResults: []
    });
    expect(drift.updateProposal.basedOn.length).toBe(drift.findings.length);
    expect(drift.updateProposal.changed.length + drift.updateProposal.added.length + drift.updateProposal.removed.length).toBeGreaterThanOrEqual(0);
  });
});
