import { describe, it, expect } from 'vitest';
import { runGuardrailEngine, checkRule } from '../guardrails/engine';
import { formatEchoSignal } from '../guardrails/signals';
import type { Guardrail, ScannedFile } from '../core/types';
import { fixtureGuardrails } from '../test/helpers';

function file(relativePath: string, content: string): ScannedFile {
  return { path: relativePath, relativePath, content };
}

describe('guardrail engine', () => {
  it('passes when no violations', () => {
    const g = fixtureGuardrails();
    const result = runGuardrailEngine({
      guardrails: g.guardrails,
      files: [file('src/client/app.ts', "import { api } from './api';")],
      imports: [{ file: 'src/client/app.ts', importPath: './api' }],
      dependencies: ['lodash']
    });
    expect(result.overall).toBe('PASS');
    expect(result.results.every((r) => r.status === 'pass')).toBe(true);
  });

  it('detects forbidden imports and emits blocking signals', () => {
    const g = fixtureGuardrails();
    const result = runGuardrailEngine({
      guardrails: g.guardrails,
      files: [file('src/client/app.ts', "import { db } from '../db';")],
      imports: [{ file: 'src/client/app.ts', importPath: '../db' }],
      dependencies: []
    });
    const gr = result.results.find((r) => r.ruleId === 'GR-001');
    expect(gr?.status).toBe('fail');
    expect(gr?.signals.length).toBe(1);
    expect(gr?.signals[0].file).toBe('src/client/app.ts');
    expect(result.overall).toBe('BLOCK');
  });

  it('detects forbidden content patterns', () => {
    const g = fixtureGuardrails();
    const result = runGuardrailEngine({
      guardrails: g.guardrails,
      files: [file('src/server/config.ts', "const api_key = '0123456789abcdef';")],
      imports: [],
      dependencies: []
    });
    const gr = result.results.find((r) => r.ruleId === 'GR-002');
    expect(gr?.status).toBe('fail');
  });

  it('does not flag files outside scope', () => {
    const g = fixtureGuardrails();
    const result = runGuardrailEngine({
      guardrails: g.guardrails,
      files: [file('src/server/db.ts', "import { db } from 'db';")],
      imports: [{ file: 'src/server/db.ts', importPath: 'db' }],
      dependencies: []
    });
    const gr = result.results.find((r) => r.ruleId === 'GR-001');
    expect(gr?.status).toBe('pass');
  });

  it('severity warning produces REVIEW', () => {
    const rule: Guardrail = {
      id: 'GR-W',
      name: 'Warning rule',
      rule: 'Do not use console.log in scope.',
      severity: 'warning',
      scope: ['src/**'],
      allowedPatterns: [],
      forbiddenPatterns: ['console\\.log'],
      enforcement: ['pattern'],
      reason: 'cleanliness',
      verification: []
    };
    const result = runGuardrailEngine({
      guardrails: [rule],
      files: [file('src/a.ts', 'console.log(1);')],
      imports: [],
      dependencies: []
    });
    expect(result.overall).toBe('REVIEW');
  });

  it('checkRule returns pass result when clean', () => {
    const g = fixtureGuardrails();
    const result = checkRule({
      rule: g.guardrails[0],
      files: [file('src/client/x.ts', 'export {}')],
      imports: [],
      dependencies: [],
      validatorKinds: ['import']
    });
    expect(result.status).toBe('pass');
    expect(result.signals).toEqual([]);
  });

  it('formats an echo signal with structure', () => {
    const g = fixtureGuardrails();
    const result = runGuardrailEngine({
      guardrails: g.guardrails,
      files: [file('src/client/bad.ts', "import { db } from '../db';")],
      imports: [{ file: 'src/client/bad.ts', importPath: '../db' }],
      dependencies: []
    });
    const signal = result.signals[0];
    const text = formatEchoSignal(signal);
    expect(text).toContain('ENGINEERINGOS ARCHITECTURAL VIOLATION');
    expect(text).toContain('GR-001');
    expect(text).toContain('BLOCKING');
    expect(text).toContain('src/client/bad.ts');
  });

  it('file-boundary validator flags cross-boundary relative imports', () => {
    const rule: Guardrail = {
      id: 'GR-B',
      name: 'Client cannot import server',
      rule: 'Client code must not import server internals.',
      severity: 'blocking',
      scope: ['src/client/**'],
      allowedPatterns: [],
      forbiddenPatterns: ['src/server/'],
      enforcement: ['file-boundary'],
      reason: 'layer separation',
      verification: []
    };
    const result = runGuardrailEngine({
      guardrails: [rule],
      files: [
        file('src/client/app.ts', "import { x } from '../server/auth';"),
        file('src/server/auth.ts', 'export const x = 1;')
      ],
      imports: [{ file: 'src/client/app.ts', importPath: '../server/auth' }],
      dependencies: []
    });
    expect(result.results[0].status).toBe('fail');
  });

  it('dependency validator flags forbidden packages', () => {
    const rule: Guardrail = {
      id: 'GR-D',
      name: 'No insecure package',
      rule: 'Do not depend on example-dep.',
      severity: 'blocking',
      scope: [],
      allowedPatterns: [],
      forbiddenPatterns: ['example-dep'],
      enforcement: ['dependency'],
      reason: 'security',
      verification: []
    };
    const result = runGuardrailEngine({
      guardrails: [rule],
      files: [file('src/index.ts', '')],
      imports: [],
      dependencies: ['example-dep']
    });
    expect(result.results[0].status).toBe('fail');
  });
});
