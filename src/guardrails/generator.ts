import type { Guardrail } from '../core/types';
import { GUARDRAIL_TEMPLATES, type GuardrailTemplate } from './templates';

export interface GenerationInput {
  frameworks: string[];
  databases: string[];
  domains: string[];
  compliance: string[];
  existingGuardrails: Guardrail[];
  maxGuardrails?: number;
}

const SEVERITY_ORDER: Record<Guardrail['severity'], number> = {
  blocking: 0,
  warning: 1,
  advisory: 2,
};

function templateMatchesFrameworks(template: GuardrailTemplate, frameworks: string[]): boolean {
  if (!template.applicableFrameworks || template.applicableFrameworks.length === 0) return true;
  return frameworks.some(f =>
    template.applicableFrameworks!.some(t => t.toLowerCase() === f.toLowerCase()),
  );
}

function templateMatchesDatabases(template: GuardrailTemplate, databases: string[]): boolean {
  if (!template.applicableDatabases || template.applicableDatabases.length === 0) return true;
  return databases.some(d =>
    template.applicableDatabases!.some(t => t.toLowerCase() === d.toLowerCase()),
  );
}

function templateMatchesDomains(template: GuardrailTemplate, domains: string[]): boolean {
  if (!template.applicableDomains || template.applicableDomains.length === 0) return true;
  return domains.some(d =>
    template.applicableDomains!.some(t => t.toLowerCase() === d.toLowerCase()),
  );
}

function templateMatchesCompliance(template: GuardrailTemplate, compliance: string[]): boolean {
  if (!template.applicableCompliance || template.applicableCompliance.length === 0) return true;
  return compliance.some(c =>
    template.applicableCompliance!.some(t => t.toLowerCase() === c.toLowerCase()),
  );
}

function templateToGuardrail(template: GuardrailTemplate): Guardrail {
  return {
    id: template.id,
    name: template.name,
    rule: template.rule,
    severity: template.severity,
    scope: template.scope,
    allowedPatterns: [],
    forbiddenPatterns: template.forbiddenPatterns,
    enforcement: template.enforcement,
    reason: template.reason,
    verification: template.verification,
  };
}

function normalizeString(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeString(a);
  const nb = normalizeString(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;

  const tokensA = na.split(/[^a-z0-9]+/).filter(Boolean);
  const tokensB = nb.split(/[^a-z0-9]+/).filter(Boolean);
  const intersection = tokensA.filter(t => tokensB.includes(t));
  const union = new Set([...tokensA, ...tokensB]);
  return union.size > 0 ? intersection.length / union.size : 0;
}

function isDuplicate(template: GuardrailTemplate, existing: Guardrail[], threshold = 0.7): boolean {
  return existing.some(eg => nameSimilarity(template.name, eg.name) >= threshold);
}

function matchesExistingForbiddenPatterns(template: GuardrailTemplate, existing: Guardrail[]): boolean {
  if (template.forbiddenPatterns.length === 0) return false;
  return existing.some(eg =>
    eg.forbiddenPatterns.length > 0 &&
    template.forbiddenPatterns.some(fp =>
      eg.forbiddenPatterns.some(efp => normalizeString(fp) === normalizeString(efp)),
    ),
  );
}

export function generateContextualGuardrails(input: GenerationInput): Guardrail[] {
  const maxGuardrails = input.maxGuardrails ?? 40;

  const matched = GUARDRAIL_TEMPLATES.filter(template => {
    if (!templateMatchesFrameworks(template, input.frameworks)) return false;
    if (!templateMatchesDatabases(template, input.databases)) return false;
    if (!templateMatchesDomains(template, input.domains)) return false;
    if (!templateMatchesCompliance(template, input.compliance)) return false;
    return true;
  });

  const deduplicated = matched.filter(template => {
    if (isDuplicate(template, input.existingGuardrails)) return false;
    if (matchesExistingForbiddenPatterns(template, input.existingGuardrails)) return false;
    return true;
  });

  const sorted = deduplicated.sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity];
    const sb = SEVERITY_ORDER[b.severity];
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });

  const capped = sorted.slice(0, maxGuardrails);

  return capped.map(templateToGuardrail);
}
