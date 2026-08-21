import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { EngineeringOSEngine } from './engine';
import { tmpDir } from './test/helpers';

describe('EngineeringOSEngine integration', () => {
  let dir: string;
  let engine: EngineeringOSEngine;

  beforeEach(() => {
    dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'src', 'client'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src', 'services'), { recursive: true });
    engine = new EngineeringOSEngine(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('runs onboarding and generates comprehensive artifacts', async () => {
    expect(await engine.isInitialized()).toBe(false);
    const result = await engine.buildOnboardingModel({
      projectName: 'Yam Marketplace',
      projectId: 'yam-marketplace',
      purpose: 'Digital marketplace for yam trading.',
      primaryUsers: ['farmers', 'buyers'],
      criticalCapabilities: ['listing', 'ordering', 'payment']
    });

    // Enriched map: foundation + capability components/data stores + payment external system.
    expect(result.map.components.length).toBeGreaterThan(3);
    expect(result.map.requirements.length).toBeGreaterThan(0);
    expect(result.map.dataStores.length).toBeGreaterThan(0);
    expect(result.map.components.some((c) => c.id === 'api')).toBe(true);
    expect(result.map.components.some((c) => c.id === 'payment-gateway')).toBe(true);
    expect(result.mentalModel.invariants.length).toBeGreaterThan(0);
    expect(result.mentalModel.architecturalPrinciples.length).toBeGreaterThan(0);
    expect(result.mentalModel.decisions.length).toBeGreaterThan(0);
    expect(result.guardrails.guardrails.length).toBeGreaterThanOrEqual(10);
    expect(result.blueprint.sections.length).toBeGreaterThanOrEqual(14);
    expect(result.blueprint.sourceSpec).toBeUndefined();
    expect(await engine.isInitialized()).toBe(true);
    expect(fs.existsSync(path.join(dir, '.engineeringos', 'map.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, '.engineeringos', 'blueprint.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, '.engineeringos', 'generated', 'map.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, '.engineeringos', 'generated', 'blueprint.md'))).toBe(true);
  });

  it('passes a pasted blueprint through to the blueprint artifact', async () => {
    const result = await engine.buildOnboardingModel({
      projectName: 'Payments',
      projectId: 'payments',
      purpose: 'P.',
      primaryUsers: [],
      criticalCapabilities: ['transfer'],
      architectureStyle: 'clean-architecture',
      securityLevel: 'hardened',
      blueprintText: 'Offline-first. Settle in XAF. 10k concurrent sellers.'
    });
    expect(result.blueprint.architectureStyle).toBe('clean-architecture');
    expect(result.blueprint.securityLevel).toBe('hardened');
    expect(result.blueprint.sourceSpec).toContain('10k concurrent sellers');
    const loaded = await engine.repository.loadBlueprint();
    expect(loaded?.sections.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(dir, '.engineeringos', 'generated', 'blueprint.md'))).toBe(true);
  });

  it('regenerates the blueprint on demand', async () => {
    await engine.buildOnboardingModel({
      projectName: 'X',
      projectId: 'x',
      purpose: 'P',
      primaryUsers: [],
      criticalCapabilities: ['feature']
    });
    const blueprint = await engine.generateBlueprint({ database: 'postgres' });
    expect(blueprint.techStack.database).toBe('postgres');
    expect(blueprint.sections.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(dir, '.engineeringos', 'generated', 'blueprint.md'))).toBe(true);
  });

  it('verifies a workspace and reports violations', async () => {
    await engine.buildOnboardingModel({
      projectName: 'X',
      projectId: 'x',
      purpose: 'P',
      primaryUsers: [],
      criticalCapabilities: ['feature']
    });
    fs.writeFileSync(
      path.join(dir, 'src', 'client', 'app.ts'),
      "import { db } from '../db';",
      'utf-8'
    );
    const result = await engine.verifyChange();
    expect(result.guardrails.overall).toBeDefined();
    expect(result.verification.overall).toBeDefined();
  });

  it('prepares a context package and writes current-task.json', async () => {
    await engine.buildOnboardingModel({
      projectName: 'Yam Marketplace',
      projectId: 'yam-marketplace',
      purpose: 'Digital marketplace for yam trading.',
      primaryUsers: ['farmers'],
      criticalCapabilities: ['listing', 'ordering', 'payment']
    });

    const result = await engine.prepareContext('Add a seller subscription to the payment workflow.');
    expect(result.package.estimatedTokens).toBeGreaterThan(0);
    expect(result.agent.system).toBe('Yam Marketplace');
    expect(fs.existsSync(path.join(dir, '.engineeringos', 'generated', 'contexts', 'current-task.json'))).toBe(true);
  });

  it('predicts impact', async () => {
    await engine.buildOnboardingModel({
      projectName: 'Yam Marketplace',
      projectId: 'yam-marketplace',
      purpose: 'Digital marketplace for yam trading.',
      primaryUsers: [],
      criticalCapabilities: ['listing', 'ordering', 'payment']
    });
    const report = await engine.predictImpact('payment');
    expect(report.target).toBeTruthy();
  });

  it('throws when not initialized', async () => {
    await expect(engine.prepareContext('x')).rejects.toThrow(/not initialized/);
  });

  it('runs code review and returns structured findings', async () => {
    await engine.buildOnboardingModel({
      projectName: 'X',
      projectId: 'x',
      purpose: 'P',
      primaryUsers: [],
      criticalCapabilities: ['feature']
    });
    fs.writeFileSync(
      path.join(dir, 'src', 'client', 'app.ts'),
      "import { db } from '../db';",
      'utf-8'
    );
    const review = await engine.codeReview();
    expect(['PASS', 'REVIEW', 'BLOCK']).toContain(review.verdict);
    expect(Array.isArray(review.findings)).toBe(true);
    expect(typeof review.summary).toBe('string');
    expect(review.summary.length).toBeGreaterThan(0);
    if (review.findings.length > 0) {
      const f = review.findings[0];
      expect(typeof f.title).toBe('string');
      expect(typeof f.description).toBe('string');
      expect(['block', 'review', 'info']).toContain(f.severity);
      expect(Array.isArray(f.evidence)).toBe(true);
    }
  });
});
