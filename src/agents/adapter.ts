import type { ContextPackage, EchoSignal, Guardrails, Invariant, Map, MentalModel } from '../core/types';

export interface AgentContext {
  system: string;
  task: string;
  purpose: string;
  architecturalPosition: string;
  relevantInvariants: string[];
  relevantDecisions: string[];
  guardrails: string[];
  risks: string[];
  unknowns: string[];
  requiredVerification: string[];
}

export interface AgentAdapter {
  getCapabilities(): string[];
  prepareContext(pkg: ContextPackage, state: AgentState): AgentContext;
  serializeContext(ctx: AgentContext): string;
}

export interface AgentState {
  map: Map;
  mentalModel: MentalModel;
  guardrails: Guardrails;
}

export class FileExportAdapter implements AgentAdapter {
  getCapabilities(): string[] {
    return ['context-export', 'preview'];
  }

  prepareContext(pkg: ContextPackage, state: AgentState): AgentContext {
    const { map, mentalModel, guardrails } = state;

    const position = buildArchitecturalPosition(map);
    const invariants = pkg.relevantInvariants
      .map((id) => mentalModel.invariants.find((i: Invariant) => i.id === id))
      .filter((i): i is Invariant => Boolean(i))
      .map((i) => `${i.id}: ${i.statement}`);

    const decisions = pkg.relevantDecisions
      .map((id) => mentalModel.decisions.find((d) => d.id === id))
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
      .map((d) => `${d.id}: ${d.decision}`);

    const gs = pkg.relevantGuardrails
      .map((id) => guardrails.guardrails.find((g) => g.id === id))
      .filter((g): g is NonNullable<typeof g> => Boolean(g))
      .map((g) => `${g.id}: ${g.rule}`);

    const risks = pkg.relevantRisks
      .map((id) => mentalModel.risks.find((r) => r.id === id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => r.name);

    const unknowns = pkg.unknowns
      .map((id) => mentalModel.unknowns.find((u) => u.id === id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => `${u.question}`);

    return {
      system: map.project.name,
      task: pkg.task,
      purpose: map.project.purpose ?? '',
      architecturalPosition: position,
      relevantInvariants: invariants,
      relevantDecisions: decisions,
      guardrails: gs,
      risks,
      unknowns,
      requiredVerification: pkg.verificationPlan
    };
  }

  serializeContext(ctx: AgentContext): string {
    const lines: string[] = [];
    lines.push('SYSTEM:');
    lines.push(`You are working within ${ctx.system}.`);
    lines.push('');
    if (ctx.purpose) {
      lines.push('SYSTEM PURPOSE:');
      lines.push(ctx.purpose);
      lines.push('');
    }
    if (ctx.architecturalPosition) {
      lines.push('ARCHITECTURAL POSITION:');
      lines.push(ctx.architecturalPosition);
      lines.push('');
    }
    lines.push('TASK:');
    lines.push(ctx.task);
    lines.push('');
    if (ctx.relevantInvariants.length > 0) {
      lines.push('RELEVANT INVARIANTS:');
      ctx.relevantInvariants.forEach((i, idx) => lines.push(`${idx + 1}. ${i}`));
      lines.push('');
    }
    if (ctx.relevantDecisions.length > 0) {
      lines.push('RELEVANT DECISIONS:');
      ctx.relevantDecisions.forEach((d, idx) => lines.push(`${idx + 1}. ${d}`));
      lines.push('');
    }
    if (ctx.guardrails.length > 0) {
      lines.push('GUARDRAILS:');
      ctx.guardrails.forEach((g, idx) => lines.push(`${idx + 1}. ${g}`));
      lines.push('');
    }
    if (ctx.risks.length > 0) {
      lines.push('RISKS:');
      ctx.risks.forEach((r, idx) => lines.push(`${idx + 1}. ${r}`));
      lines.push('');
    }
    if (ctx.unknowns.length > 0) {
      lines.push('UNKNOWN:');
      ctx.unknowns.forEach((u, idx) => lines.push(`${idx + 1}. ${u}`));
      lines.push('');
    }
    lines.push('REQUIRED VERIFICATION:');
    if (ctx.requiredVerification.length > 0) {
      ctx.requiredVerification.forEach((v) => lines.push(`- ${v}`));
    } else {
      lines.push('- none specified');
    }
    return lines.join('\n');
  }
}

function buildArchitecturalPosition(map: Map): string {
  if (map.relationships.length === 0) return '';
  const components = map.components.map((c) => c.id);
  const layers: string[] = [];
  for (const id of components) {
    const deps = map.relationships.filter((r) => r.from === id).map((r) => r.to);
    if (deps.length > 0) {
      layers.push(`${id} → ${deps.join(', ')}`);
    }
  }
  return layers.join('\n');
}

export const MCP_TOOLS = [
  'engineeringos.get_project',
  'engineeringos.get_map',
  'engineeringos.get_component',
  'engineeringos.get_workflow',
  'engineeringos.get_invariants',
  'engineeringos.get_guardrails',
  'engineeringos.get_decisions',
  'engineeringos.get_unknowns',
  'engineeringos.get_impact',
  'engineeringos.verify',
  'engineeringos.update_model'
] as const;

export function describeEchoSignals(signals: EchoSignal[]): string {
  return signals.map((s) => `[${s.severity.toUpperCase()}] ${s.ruleId} ${s.ruleName}: ${s.message} (${s.file})`).join('\n');
}
