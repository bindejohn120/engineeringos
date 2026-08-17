import { describe, it } from 'vitest';
import { EngineeringOSEngine } from '../engine';

describe('rebuild dogfood', () => {
  it('rebuilds state for dogfood', async () => {
    const engine = new EngineeringOSEngine(process.cwd());
    const result = await engine.buildOnboardingModel({
      projectName: 'EngineeringOS',
      projectId: 'engineeringos-extension',
      purpose: 'Engineering intelligence for AI-powered software development. Gives AI coding agents a persistent engineering map, mental model, and enforceable guardrails.',
      primaryUsers: ['developers', 'tech leads', 'AI coding agents'],
      criticalCapabilities: ['map generation', 'mental model generation', 'guardrail enforcement', 'context retrieval', 'drift detection', 'impact analysis', 'verification'],
      guardrailSeed: true,
      architectureStyle: 'clean-architecture',
      securityLevel: 'hardened',
      language: 'TypeScript',
      runtime: 'Node.js',
      framework: 'VS Code Extension API',
      database: 'JSON artifacts',
      useAI: false
    });
    console.log('rebuilt:', result.map.components.length, 'components,', result.guardrails.guardrails.length, 'guardrails');
  }, 10000);
});
