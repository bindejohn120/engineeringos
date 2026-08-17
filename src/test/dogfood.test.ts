import { describe, it } from 'vitest';
import { EngineeringOSEngine } from '../engine';

describe('dogfood', () => {
  it('verifies this repository against its own model', async () => {
    const engine = new EngineeringOSEngine(process.cwd());
    const state = await engine.loadState();
    if (!state) throw new Error('dogfood state did not load');
    console.log('components:', state.map.components.length);
    console.log('invariants:', state.mentalModel.invariants.length);
    console.log('guardrails:', state.guardrails.guardrails.length);

    const analysis = await engine.verifyChange();
    console.log('verification overall:', analysis.verification.overall);
    for (const r of analysis.verification.results) {
      console.log('  ', r.check, '->', r.verdict);
    }
    console.log('drift findings:', analysis.drift.findings.length);
    for (const f of analysis.drift.findings) {
      console.log('  ', f.driftType, f.severity, '-', f.title, '|', f.evidence.join(', '));
    }

    const ctx = await engine.prepareContext('Fix a bug in the drift detection engine.');
    console.log('context estimated tokens:', ctx.package.estimatedTokens);
    console.log('context contains:', ctx.summary.contains.length, 'sections');
    const impact = await engine.predictImpact('drift detection');
    console.log('impact:', impact.severity, '| components:', impact.affectedComponents.map((c) => c.name).join(', '));
    console.log('impact target:', impact.target, '| invariants:', impact.relevantInvariants.length, '| guardrails:', impact.relevantGuardrails.length, '| workflows:', impact.affectedWorkflows.join(','));

    const blueprint = await engine.generateBlueprint({
      architectureStyle: 'clean-architecture',
      securityLevel: 'hardened',
      language: 'TypeScript',
      runtime: 'Node.js',
      framework: 'VS Code Extension API',
      database: 'JSON artifacts (.engineeringos/*.json)'
    });
    console.log('blueprint sections:', blueprint.sections.length, '| style:', blueprint.architectureStyle, '| security:', blueprint.securityLevel);
  }, 30000);
});
