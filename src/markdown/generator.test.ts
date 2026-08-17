import { describe, it, expect } from 'vitest';
import { renderMapMd, renderMentalModelMd, renderGuardrailsMd, renderAdr } from '../markdown/generator';
import { fixtureMap, fixtureMentalModel, fixtureGuardrails } from '../test/helpers';

describe('markdown generator', () => {
  it('renders map.md from JSON', () => {
    const md = renderMapMd(fixtureMap());
    expect(md).toContain('# Engineering Map');
    expect(md).toContain('Payment Service');
    expect(md).toContain('Checkout');
    expect(md).toContain('REQ-001');
    expect(md).not.toContain('undefined');
  });

  it('renders mental-model.md from JSON', () => {
    const md = renderMentalModelMd(fixtureMentalModel());
    expect(md).toContain('# Engineering Mental Model');
    expect(md).toContain('INV-001');
    expect(md).toContain('idempotent');
    expect(md).toContain('UNK-001');
    expect(md).toContain('ADR-001');
  });

  it('renders guardrails.md from JSON', () => {
    const md = renderGuardrailsMd(fixtureGuardrails());
    expect(md).toContain('# Engineering Guardrails');
    expect(md).toContain('GR-001');
    expect(md).toContain('BLOCKING');
  });

  it('renders an ADR document', () => {
    const md = renderAdr(fixtureMentalModel().decisions[0]);
    expect(md).toContain('Payment provider adapter');
    expect(md).toContain('## Decision');
    expect(md).toContain('## Alternatives');
  });
});
