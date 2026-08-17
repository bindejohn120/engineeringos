import { describe, it, expect } from 'vitest';
import { buildContextPackage, analyzeTask, summarizeContext, textScore } from '../context/engine';
import { fixtureMap, fixtureMentalModel, fixtureGuardrails } from '../test/helpers';

describe('context engine', () => {
  it('analyzes a task into keywords', () => {
    const analysis = analyzeTask('Add seller subscriptions to the payment service.');
    expect(analysis.keywords.length).toBeGreaterThan(0);
    expect(analysis.keywords).toContain('payment');
    expect(analysis.keywords).toContain('seller');
  });

  it('scores text by keyword overlap', () => {
    expect(textScore('payment service processes payments', ['payment'])).toBeGreaterThan(0);
    expect(textScore('orders are managed elsewhere', ['payment'])).toBe(0);
  });

  it('builds a context package with relevant components only', () => {
    const map = fixtureMap();
    const model = fixtureMentalModel();
    const g = fixtureGuardrails();

    const pkg = buildContextPackage({
      task: 'Modify the payment service to handle refunds.',
      map,
      mentalModel: model,
      guardrails: g
    });

    expect(pkg.task).toContain('payment service');
    expect(pkg.relevantComponents).toContain('payment-service');
    expect(pkg.relevantInvariants).toContain('INV-001');
    expect(pkg.estimatedTokens).toBeGreaterThan(0);
    expect(pkg.createdAt).toBeTruthy();
  });

  it('does not inject unrelated knowledge', () => {
    const map = fixtureMap();
    const model = fixtureMentalModel();
    const g = fixtureGuardrails();

    const pkg = buildContextPackage({
      task: 'Add a search index for products.',
      map,
      mentalModel: model,
      guardrails: g
    });

    expect(pkg.relevantComponents).not.toContain('payment-service');
    expect(pkg.relevantGuardrails.length).toBeLessThanOrEqual(6);
  });

  it('includes verification plan', () => {
    const pkg = buildContextPackage({
      task: 'Change payment confirmation handling.',
      map: fixtureMap(),
      mentalModel: fixtureMentalModel(),
      guardrails: fixtureGuardrails()
    });
    expect(pkg.verificationPlan.length).toBeGreaterThan(0);
    expect(pkg.verificationPlan.some((v) => v.includes('idempotent'))).toBe(true);
  });

  it('summarizes context contents', () => {
    const pkg = buildContextPackage({
      task: 'Fix payment service retry logic.',
      map: fixtureMap(),
      mentalModel: fixtureMentalModel(),
      guardrails: fixtureGuardrails()
    });
    const summary = summarizeContext(pkg);
    expect(summary.contains).toContain('architecture');
    expect(summary.doesNotContain).toContain('secrets');
  });
});
