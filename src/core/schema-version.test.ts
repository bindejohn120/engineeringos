import { describe, it, expect } from 'vitest';
import { parseVersion, isCompatible, bumpVersion, CURRENT_SCHEMA_VERSION } from '../core/schema-version';

describe('schema-version', () => {
  it('parses semver', () => {
    expect(parseVersion('2.0.0')).toEqual([2, 0, 0]);
    expect(parseVersion('1.10.3')).toEqual([1, 10, 3]);
  });

  it('isCompatible checks major+minor', () => {
    expect(isCompatible('2.0.0', '2.0.0')).toBe(true);
    expect(isCompatible('2.1.0', '2.0.0')).toBe(true);
    expect(isCompatible('2.0.0', '2.1.0')).toBe(false);
    expect(isCompatible('3.0.0', '2.0.0')).toBe(false);
  });

  it('bumpVersion increments correctly', () => {
    expect(bumpVersion('1.0.0', 'major')).toBe('2.0.0');
    expect(bumpVersion('1.2.0', 'minor')).toBe('1.3.0');
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
  });

  it('CURRENT_SCHEMA_VERSION is defined', () => {
    expect(CURRENT_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
