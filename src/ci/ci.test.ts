import { describe, it, expect } from 'vitest';
import { generateGitHubActionsWorkflow, generateCIConfig } from '../ci/github-actions';
import { generatePRReportMarkdown, generatePRReportJSON, generateStatusCheckConclusion } from '../ci/pr-report';
import type { PRReportInput } from '../ci/pr-report';

describe('GitHub Actions', () => {
  it('generates valid workflow YAML', () => {
    const workflow = generateGitHubActionsWorkflow();
    expect(workflow).toContain('name: EngineeringOS Validation');
    expect(workflow).toContain('on:');
    expect(workflow).toContain('validate');
    expect(workflow).toContain('health');
    expect(workflow).toContain('drift');
    expect(workflow).toContain('actions/checkout@v4');
  });

  it('generates workflow with custom options', () => {
    const workflow = generateGitHubActionsWorkflow({ nodeVersion: '22', failOnBlock: false });
    expect(workflow).toContain('node-version: 22');
    expect(workflow).not.toContain('Check for blocking violations');
  });

  it('generates CI config', () => {
    const config = generateCIConfig();
    expect(config.engineeringos).toBeDefined();
    expect((config.engineeringos as any).version).toBe('2.0.0');
  });
});

const MOCK_PR_INPUT: PRReportInput = {
  commitSha: 'abc123',
  branch: 'feature/auth',
  baseBranch: 'main',
  changedFiles: ['src/auth.ts', 'src/user.ts'],
  validation: {
    overall: 'BLOCK',
    violations: [
      { ruleId: 'GR-001', severity: 'BLOCKING', message: 'Forbidden import', file: 'src/auth.ts', line: 5 }
    ]
  },
  health: { overall: 0.65, grade: 'D', criticalOverrides: ['2 secrets found'] },
  drift: { findings: [{ driftType: 'code-to-model', severity: 'WARNING', title: 'Unmapped source', evidence: ['src/new.ts'] }] },
  repository: { totalFiles: 50, testFiles: 10, languages: { typescript: 40, javascript: 10 } }
};

describe('PR Report', () => {
  it('generates markdown report', () => {
    const md = generatePRReportMarkdown(MOCK_PR_INPUT);
    expect(md).toContain('EngineeringOS Validation Report');
    expect(md).toContain('BLOCKED');
    expect(md).toContain('GR-001');
    expect(md).toContain('src/auth.ts');
    expect(md).toContain('65%');
  });

  it('generates JSON report', () => {
    const json = JSON.parse(generatePRReportJSON(MOCK_PR_INPUT));
    expect(json.engineeringos).toBe('2.0.0');
    expect(json.verdict).toBe('BLOCK');
    expect(json.health.score).toBe(0.65);
    expect(json.violations).toBe(1);
  });

  it('generates status check conclusion', () => {
    expect(generateStatusCheckConclusion('PASS')).toBe('success');
    expect(generateStatusCheckConclusion('BLOCK')).toBe('failure');
    expect(generateStatusCheckConclusion('REVIEW')).toBe('neutral');
    expect(generateStatusCheckConclusion('NOT_VALIDATED')).toBe('neutral');
  });

  it('PR report for passing change', () => {
    const passInput: PRReportInput = {
      ...MOCK_PR_INPUT,
      validation: { overall: 'PASS', violations: [] },
      health: { overall: 0.92, grade: 'A', criticalOverrides: [] },
      drift: { findings: [] }
    };
    const md = generatePRReportMarkdown(passInput);
    expect(md).toContain('PASSED');
    expect(md).not.toContain('BLOCKED');
  });
});
