import type { Severity, VerificationVerdict } from './types';

export const SEVERITY_ORDER: Record<Severity, number> = {
  advisory: 0,
  warning: 1,
  blocking: 2
};

export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

export function describeConfidence(value?: number): string {
  if (value === undefined) return 'UNKNOWN';
  if (value < 0.4) return 'LOW';
  if (value < 0.7) return 'MODERATE';
  if (value < 0.9) return 'HIGH';
  return 'VERY HIGH';
}

export function verdictFromSeverity(severity: Severity): VerificationVerdict {
  switch (severity) {
    case 'blocking':
      return 'BLOCK';
    case 'warning':
      return 'REVIEW';
    case 'advisory':
      return 'PASS';
  }
}

export function aggregateVerdicts(verdicts: VerificationVerdict[]): VerificationVerdict {
  let worst: VerificationVerdict = 'PASS';
  for (const v of verdicts) {
    if (v === 'BLOCK') return 'BLOCK';
    if (v === 'REVIEW') worst = 'REVIEW';
  }
  return worst;
}

export const KNOWLEDGE_TYPES = [
  'fact',
  'inference',
  'assumption',
  'recommendation',
  'proposal',
  'decision',
  'implementation',
  'verification',
  'unknown'
] as const;

export const REQUIREMENT_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const ascii = (trimmed.match(/[\x00-\x7F]/g) ?? []).length;
  const nonAscii = trimmed.length - ascii;
  return Math.ceil(ascii / 4 + nonAscii);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
