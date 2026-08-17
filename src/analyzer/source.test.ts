import { describe, it, expect } from 'vitest';
import { matchesAny, extractImports, toRegex } from '../analyzer/source';

describe('analyzer source utilities', () => {
  it('matches exact globs', () => {
    expect(matchesAny('src/client/checkout.ts', ['src/client/**'])).toBe(true);
    expect(matchesAny('src/services/payment.ts', ['src/client/**'])).toBe(false);
  });

  it('matches directory globs', () => {
    expect(matchesAny('src/services/payment.ts', ['src/services/**'])).toBe(true);
    expect(matchesAny('src/services/sub/payment.ts', ['src/services/**'])).toBe(true);
  });

  it('matches exact file patterns', () => {
    expect(matchesAny('src/services/payment.ts', ['src/services/payment.ts'])).toBe(true);
    expect(matchesAny('src/services/order.ts', ['src/services/payment.ts'])).toBe(false);
  });

  it('matches wildcard patterns', () => {
    expect(matchesAny('src/foo/bar.ts', ['src/*/bar.ts'])).toBe(true);
    expect(matchesAny('src/foo/nested/bar.ts', ['src/*/bar.ts'])).toBe(false);
  });

  it('handles backslash paths', () => {
    expect(matchesAny('src\\client\\checkout.ts', ['src/client/**'])).toBe(true);
  });

  it('extracts esm imports', () => {
    const content = "import { x } from 'lodash';\nimport y from '../utils';\n";
    expect(extractImports(content)).toEqual(['lodash', '../utils']);
  });

  it('extracts require calls', () => {
    const content = "const fs = require('fs');\n";
    expect(extractImports(content)).toEqual(['fs']);
  });

  it('extracts dynamic imports', () => {
    const content = "const m = import('./lazy');\n";
    expect(extractImports(content)).toEqual(['./lazy']);
  });

  it('compiles glob to regex', () => {
    expect(toRegex('src/**').test('src/a/b.ts')).toBe(true);
    expect(toRegex('*.ts').test('x.ts')).toBe(true);
    expect(toRegex('*.ts').test('x.js')).toBe(false);
  });
});

describe('negative scope patterns', () => {
  it('excludes files matched by leading-bang patterns', () => {
    expect(matchesAny('src/foo.ts', ['src/**', '!**/*.test.*'])).toBe(true);
    expect(matchesAny('src/foo.test.ts', ['src/**', '!**/*.test.*'])).toBe(false);
    expect(matchesAny('src/__tests__/x.ts', ['src/**', '!**/__tests__/**'])).toBe(false);
  });

  it('still requires a positive match', () => {
    expect(matchesAny('lib/foo.ts', ['src/**', '!src/**/x/**'])).toBe(false);
  });
});
