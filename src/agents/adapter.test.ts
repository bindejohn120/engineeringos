import { describe, it, expect } from 'vitest';
import { FileExportAdapter, describeEchoSignals } from '../agents/adapter';
import { buildContextPackage } from '../context/engine';
import { fixtureMap, fixtureMentalModel, fixtureGuardrails } from '../test/helpers';
import type { EchoSignal } from '../core/types';

describe('agent adapter', () => {
  it('prepares agent context from a package', () => {
    const adapter = new FileExportAdapter();
    const pkg = buildContextPackage({
      task: 'Add seller subscriptions to the payment service.',
      map: fixtureMap(),
      mentalModel: fixtureMentalModel(),
      guardrails: fixtureGuardrails()
    });
    const ctx = adapter.prepareContext(pkg, {
      map: fixtureMap(),
      mentalModel: fixtureMentalModel(),
      guardrails: fixtureGuardrails()
    });
    expect(ctx.system).toBe('Test App');
    expect(ctx.task).toContain('subscriptions');
    expect(ctx.relevantInvariants.length).toBeGreaterThan(0);
  });

  it('serializes context in the required structure', () => {
    const adapter = new FileExportAdapter();
    const pkg = buildContextPackage({
      task: 'Make payment webhook processing idempotent.',
      map: fixtureMap(),
      mentalModel: fixtureMentalModel(),
      guardrails: fixtureGuardrails()
    });
    const ctx = adapter.prepareContext(pkg, {
      map: fixtureMap(),
      mentalModel: fixtureMentalModel(),
      guardrails: fixtureGuardrails()
    });
    const text = adapter.serializeContext(ctx);
    expect(text).toContain('SYSTEM:');
    expect(text).toContain('SYSTEM PURPOSE:');
    expect(text).toContain('RELEVANT INVARIANTS:');
    expect(text).toContain('GUARDRAILS:');
    expect(text).toContain('REQUIRED VERIFICATION:');
  });

  it('reports capabilities', () => {
    expect(new FileExportAdapter().getCapabilities()).toContain('context-export');
  });

  it('describes echo signals for agent feedback', () => {
    const signals: EchoSignal[] = [
      {
        ruleId: 'GR-001',
        ruleName: 'No Client DB Access',
        severity: 'blocking',
        message: 'client imports db',
        file: 'src/client/x.ts'
      }
    ];
    const text = describeEchoSignals(signals);
    expect(text).toContain('GR-001');
    expect(text).toContain('BLOCKING');
  });
});
