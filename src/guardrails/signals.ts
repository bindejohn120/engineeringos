import type { EchoSignal, Guardrail, Severity } from '../core/types';

export function severityLabel(severity: Severity): string {
  switch (severity) {
    case 'blocking':
      return 'BLOCKING';
    case 'warning':
      return 'WARNING';
    case 'advisory':
      return 'ADVISORY';
  }
}

export function buildEchoSignal(
  rule: Guardrail,
  message: string,
  file: string,
  extras?: Partial<EchoSignal>
): EchoSignal {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    message,
    file,
    line: extras?.line,
    expectedBoundary: extras?.expectedBoundary,
    suggestedCorrection: extras?.suggestedCorrection ?? defaultCorrection(rule)
  };
}

export function formatEchoSignal(signal: EchoSignal): string {
  const lines = [
    'ENGINEERINGOS ARCHITECTURAL VIOLATION',
    '',
    `Rule: ${signal.ruleId} (${signal.ruleName})`,
    '',
    signal.message,
    '',
    `File: ${signal.file}`
  ];
  if (signal.expectedBoundary && signal.expectedBoundary.length > 0) {
    lines.push('', 'Expected boundary:', '', signal.expectedBoundary.join('\n→ '));
  }
  if (signal.suggestedCorrection) {
    lines.push('', `Severity: ${severityLabel(signal.severity)}`, '', `Suggested correction: ${signal.suggestedCorrection}`);
  }
  return lines.join('\n');
}

function defaultCorrection(rule: Guardrail): string {
  if (rule.reason) return `Revisit ${rule.id} (${rule.name}). ${rule.reason}`;
  return `Revisit ${rule.id} (${rule.name}).`;
}
