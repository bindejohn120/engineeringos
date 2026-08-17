export type OutputFormat = 'json' | 'markdown' | 'sarif' | 'text';

export interface CLIResult {
  exitCode: number;
  output: string;
  format: OutputFormat;
}

export function formatJSON(data: unknown, pretty = true): string {
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

export function formatMarkdown(lines: string[]): string {
  return lines.join('\n');
}

export function formatSARIF(results: { ruleId: string; level: string; message: string; file?: string; line?: number }[]): string {
  const runs = results.map(r => ({
    ruleId: r.ruleId,
    level: r.level,
    message: { text: r.message },
    locations: r.file ? [{
      physicalLocation: {
        artifactLocation: { uri: r.file },
        region: r.line ? { startLine: r.line } : undefined
      }
    }] : []
  }));

  return JSON.stringify({
    version: '2.1.0',
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    runs: [{
      tool: { driver: { name: 'engineeringos', version: '2.0.0' } },
      results: runs
    }]
  }, null, 2);
}

export function formatText(summary: string, details: string[]): string {
  return [summary, '', ...details].join('\n');
}
