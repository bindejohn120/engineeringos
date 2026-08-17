import { describe, it, expect } from 'vitest';
import { generateId, parseId, idType, slugify, resetCounters } from '../core/ids';

describe('ids', () => {
  it('generates sequential IDs', () => {
    resetCounters();
    expect(generateId('component')).toBe('CMP-001');
    expect(generateId('component')).toBe('CMP-002');
    expect(generateId('invariant')).toBe('INV-001');
    expect(generateId('guardrail')).toBe('GR-001');
  });

  it('parses IDs', () => {
    expect(parseId('CMP-001')).toEqual({ prefix: 'CMP', number: 1 });
    expect(parseId('INV-042')).toEqual({ prefix: 'INV', number: 42 });
    expect(parseId('invalid')).toBeNull();
  });

  it('resolves ID type', () => {
    expect(idType('CMP-001')).toBe('component');
    expect(idType('INV-001')).toBe('invariant');
    expect(idType('GR-001')).toBe('guardrail');
    expect(idType('DEC-001')).toBe('decision');
    expect(idType('SIG-001')).toBe('signal');
  });

  it('slugifies text', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('src/client/app.ts')).toBe('src-client-app-ts');
    expect(slugify('  spaces  ')).toBe('spaces');
  });
});
