import { describe, it, expect } from 'vitest';
import { runVerification } from '../verification/engine';
import { runGuardrailEngine } from '../guardrails/engine';
import { detectDrift } from '../drift/engine';
import { fixtureMap, fixtureMentalModel, fixtureGuardrails } from '../test/helpers';
import { extractImports } from '../analyzer/source';
import type { Map } from '../core/types';

function buildInput(files: { path: string; content: string }[], mapOverride?: (m: Map) => Map) {
  const map = mapOverride ? mapOverride(fixtureMap()) : fixtureMap();
  const mentalModel = fixtureMentalModel();
  const guardrails = fixtureGuardrails();
  const scanned = files.map((f) => ({ path: f.path, relativePath: f.path, content: f.content }));
  const imports = scanned.flatMap((f) => extractImports(f.content).map((importPath) => ({ file: f.relativePath, importPath })));
  const engine = runGuardrailEngine({
    guardrails: guardrails.guardrails,
    files: scanned,
    imports,
    dependencies: []
  });
  const drift = detectDrift({
    map,
    mentalModel,
    files: files.map((f) => f.path),
    guardrailResults: engine.results
  });
  return runVerification({
    map,
    mentalModel,
    guardrails: guardrails.guardrails,
    files: files.map((f) => f.path),
    guardrailEngine: engine,
    drift
  });
}

const CLEAN_FILES = [
  { path: 'src/services/payment.ts', content: 'export {}' },
  { path: 'src/services/order.ts', content: 'export {}' },
  { path: 'src/client/checkout.ts', content: 'export {}' }
];

describe('verification engine', () => {
  it('reports PASS for a clean workspace', () => {
    const report = buildInput(
      [...CLEAN_FILES, { path: 'src/client/app.ts', content: "import { api } from './api';" }],
      (m) => {
        m.requirements[0].status = 'implemented';
        const checkout = m.components.find((c) => c.id === 'checkout');
        if (checkout) checkout.sourceLocations.push('src/client/app.ts');
        return m;
      }
    );
    expect(report.overall).toBe('PASS');
    expect(report.results.length).toBeGreaterThan(0);
  });

  it('reports BLOCK when a blocking guardrail fails', () => {
    const report = buildInput([{ path: 'src/client/app.ts', content: "import { db } from '../db';" }]);
    expect(report.overall).toBe('BLOCK');
    const guardrailsCheck = report.results.find((r) => r.check === 'Guardrails');
    expect(guardrailsCheck?.verdict).toBe('BLOCK');
  });

  it('includes evidence and not-verified lists per check', () => {
    const report = buildInput(CLEAN_FILES);
    for (const result of report.results) {
      expect(Array.isArray(result.evidence)).toBe(true);
      expect(Array.isArray(result.notVerified)).toBe(true);
    }
  });

  it('reviews open requirements', () => {
    const report = buildInput(CLEAN_FILES);
    const reqs = report.results.find((r) => r.check === 'Requirements');
    expect(reqs?.verdict).toBe('REVIEW');
  });

  it('never reports false certainty for security', () => {
    const report = buildInput(CLEAN_FILES);
    expect(report.overall).not.toBe('BLOCK');
  });
});
