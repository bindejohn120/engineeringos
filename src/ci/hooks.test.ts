import { describe, it, expect } from 'vitest';
import { hooksInstalled } from '../ci/hooks';

describe('git hooks', () => {
  it('detects hooks not installed in non-git dir', () => {
    const result = hooksInstalled('/tmp');
    expect(result.preCommit).toBe(false);
    expect(result.prePush).toBe(false);
  });
});
