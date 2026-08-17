export type Verdict = 'PASS' | 'WARN' | 'REVIEW' | 'BLOCK' | 'NOT_VALIDATED' | 'SKIP';

export const EXIT_CODES = {
  PASS: 0,
  WARN: 1,
  BLOCK: 2,
  CONFIG_FAILURE: 3,
  NOT_VALIDATED: 4
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export function verdictToExitCode(v: Verdict): ExitCode {
  switch (v) {
    case 'PASS': return EXIT_CODES.PASS;
    case 'WARN': return EXIT_CODES.WARN;
    case 'REVIEW': return EXIT_CODES.WARN;
    case 'BLOCK': return EXIT_CODES.BLOCK;
    case 'NOT_VALIDATED': return EXIT_CODES.NOT_VALIDATED;
    case 'SKIP': return EXIT_CODES.NOT_VALIDATED;
  }
}

export function worstVerdict(verdicts: Verdict[]): Verdict {
  const priority: Verdict[] = ['BLOCK', 'REVIEW', 'NOT_VALIDATED', 'WARN', 'SKIP', 'PASS'];
  for (const v of priority) {
    if (verdicts.includes(v)) return v;
  }
  return 'PASS';
}

export interface Evidence {
  type: 'file' | 'test' | 'import' | 'schema' | 'runtime' | 'manual' | 'rule' | 'analysis';
  location: string;
  description: string;
  confidence: number;
  commitSha?: string;
  timestamp?: string;
}

export interface Violation {
  ruleId: string;
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  message: string;
  file?: string;
  line?: number;
  endLine?: number;
  evidence: Evidence[];
  remediation?: string;
  unsafeShortcut?: string;
}

export interface CheckResult {
  ruleId: string;
  verdict: Verdict;
  violations: Violation[];
  checkedAt: string;
  durationMs: number;
  evidence: Evidence[];
}

export interface ValidationReport {
  schemaVersion: string;
  project: string;
  commitSha: string | null;
  checkedAt: string;
  overall: Verdict;
  results: CheckResult[];
  summary: {
    total: number;
    pass: number;
    warn: number;
    block: number;
    notValidated: number;
    review: number;
  };
  exitCode: ExitCode;
}
