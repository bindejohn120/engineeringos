import { describe, it, expect } from 'vitest';
import { verdictToExitCode, worstVerdict, EXIT_CODES } from '../core/protocol';

describe('protocol', () => {
  it('maps verdicts to exit codes', () => {
    expect(verdictToExitCode('PASS')).toBe(0);
    expect(verdictToExitCode('WARN')).toBe(1);
    expect(verdictToExitCode('REVIEW')).toBe(1);
    expect(verdictToExitCode('BLOCK')).toBe(2);
    expect(verdictToExitCode('NOT_VALIDATED')).toBe(4);
    expect(verdictToExitCode('SKIP')).toBe(4);
  });

  it('worstVerdict returns highest severity', () => {
    expect(worstVerdict(['PASS', 'PASS'])).toBe('PASS');
    expect(worstVerdict(['PASS', 'WARN'])).toBe('WARN');
    expect(worstVerdict(['PASS', 'BLOCK'])).toBe('BLOCK');
    expect(worstVerdict(['REVIEW', 'WARN'])).toBe('REVIEW');
    expect(worstVerdict(['NOT_VALIDATED', 'PASS'])).toBe('NOT_VALIDATED');
    expect(worstVerdict([])).toBe('PASS');
  });

  it('EXIT_CODES are stable', () => {
    expect(EXIT_CODES.PASS).toBe(0);
    expect(EXIT_CODES.WARN).toBe(1);
    expect(EXIT_CODES.BLOCK).toBe(2);
    expect(EXIT_CODES.CONFIG_FAILURE).toBe(3);
    expect(EXIT_CODES.NOT_VALIDATED).toBe(4);
  });
});
