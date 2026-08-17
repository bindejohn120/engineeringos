import type { Guardrails, ImpactReport, Map, MentalModel } from '../core/types';

export function buildAskSystem(map: Map, mentalModel: MentalModel, guardrails: Guardrails): string {
  const lines: string[] = [
    'You are EngineeringOS, the engineering intelligence layer for an AI coding agent.',
    'Answer ONLY from the engineering facts below. If the facts are insufficient, say what is unknown.',
    'Be concrete, reference component IDs and invariant IDs, and never invent requirements.',
    '',
    `SYSTEM: ${map.project.name}`,
    `PURPOSE: ${map.project.purpose ?? ''}`,
    ''
  ];

  if (mentalModel.systemUnderstanding.businessObjective) {
    lines.push(`BUSINESS OBJECTIVE: ${mentalModel.systemUnderstanding.businessObjective}`);
  }
  if (map.components.length > 0) {
    lines.push('COMPONENTS:');
    for (const c of map.components) {
      lines.push(`- ${c.id} (${c.name}): ${c.purpose}`);
    }
  }
  if (map.relationships.length > 0) {
    lines.push('RELATIONSHIPS:');
    for (const r of map.relationships) {
      lines.push(`- ${r.from} -> ${r.to} [${r.type}]${r.description ? `: ${r.description}` : ''}`);
    }
  }
  if (mentalModel.invariants.length > 0) {
    lines.push('INVARIANTS:');
    for (const i of mentalModel.invariants) {
      lines.push(`- ${i.id} [${i.severity}]: ${i.statement}`);
    }
  }
  if (mentalModel.decisions.length > 0) {
    lines.push('DECISIONS:');
    for (const d of mentalModel.decisions) {
      lines.push(`- ${d.id}: ${d.decision}`);
    }
  }
  if (guardrails.guardrails.length > 0) {
    lines.push('GUARDRAILS:');
    for (const g of guardrails.guardrails) {
      lines.push(`- ${g.id} [${g.severity}]: ${g.rule}`);
    }
  }
  if (mentalModel.risks.length > 0) {
    lines.push('RISKS:');
    for (const r of mentalModel.risks) {
      lines.push(`- ${r.name}: ${r.description}`);
    }
  }
  if (mentalModel.unknowns.length > 0) {
    lines.push('OPEN UNKNOWNS:');
    for (const u of mentalModel.unknowns) {
      lines.push(`- ${u.id}: ${u.question}`);
    }
  }
  return lines.join('\n');
}

export function buildAskUser(question: string, impact?: ImpactReport | null): string {
  const lines: string[] = [question];
  if (impact) {
    lines.push(
      '',
      `An automated impact scan of "${impact.target}" reported severity ${impact.severity}.`,
      impact.affectedComponents.length ? `Affected: ${impact.affectedComponents.map((c) => c.name).join(', ')}.` : '',
      impact.affectedWorkflows.length ? `Workflows: ${impact.affectedWorkflows.join(', ')}.` : '',
      impact.requiredVerification.length ? `Required verification: ${impact.requiredVerification.join('; ')}.` : ''
    );
  }
  return lines.filter(Boolean).join('\n');
}
