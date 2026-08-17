import { describe, it, expect } from 'vitest';
import { formatJSON, formatMarkdown, formatSARIF, formatText } from '../cli/format';

describe('CLI format', () => {
  it('formatJSON produces valid JSON', () => {
    const data = { overall: 'PASS', count: 5 };
    const result = formatJSON(data);
    expect(JSON.parse(result)).toEqual(data);
  });

  it('formatJSON compact mode', () => {
    const result = formatJSON({ a: 1 }, false);
    expect(result).toBe('{"a":1}');
  });

  it('formatMarkdown joins lines', () => {
    const result = formatMarkdown(['# Title', '', 'Content']);
    expect(result).toBe('# Title\n\nContent');
  });

  it('formatSARIF produces valid SARIF', () => {
    const results = [
      { ruleId: 'GR-001', level: 'error', message: 'Forbidden import', file: 'src/app.ts', line: 10 }
    ];
    const sarif = JSON.parse(formatSARIF(results));
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].tool.driver.name).toBe('engineeringos');
    expect(sarif.runs[0].results[0].ruleId).toBe('GR-001');
  });

  it('formatText produces readable output', () => {
    const result = formatText('Summary line', ['detail 1', 'detail 2']);
    expect(result).toContain('Summary line');
    expect(result).toContain('detail 1');
  });
});
