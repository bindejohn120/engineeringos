import type { Component, Evidence, Guardrail, ImpactReport, Map, MentalModel, Workflow } from '../core/types';

export function resolveComponentId(map: Map, target: string): string | null {
  const exact = map.components.find((c) => c.id === target);
  if (exact) return exact.id;
  const normalized = target.toLowerCase().replace(/[\s_-]+/g, '');
  const byName = map.components.find((c) => c.name.toLowerCase().replace(/[\s_-]+/g, '') === normalized);
  if (byName) return byName.id;
  const byPartial = map.components.find((c) => c.id.toLowerCase().replace(/[\s_-]+/g, '').includes(normalized) || normalized.includes(c.id.toLowerCase().replace(/[\s_-]+/g, '')));
  return byPartial?.id ?? null;
}

export function computeImpact(input: {
  target: string;
  map: Map;
  mentalModel: MentalModel;
  guardrails: GuardrailsLike;
}): ImpactReport {
  const { target, map, mentalModel, guardrails } = input;
  const componentId = resolveComponentId(map, target);

  const affected = new Map<string, { id: string; name: string; kind: ImpactReport['affectedComponents'][number]['kind'] }>();
  const targetNames = new Set<string>();

  if (componentId) {
    const component = map.components.find((c) => c.id === componentId);
    if (component) targetNames.add(component.name.toLowerCase());

    const direct = map.relationships
      .filter((r) => r.from === componentId || r.to === componentId)
      .flatMap((r) => [r.from, r.to])
      .filter((id) => id !== componentId);

    for (const id of direct) {
      const c = map.components.find((x) => x.id === id);
      if (c && !affected.has(id)) {
        affected.set(id, { id, name: c.name, kind: 'component' });
        targetNames.add(c.name.toLowerCase());
      }
    }

    // second hop
    for (const id of direct) {
      for (const r of map.relationships.filter((rel) => rel.from === id || rel.to === id)) {
        const other = r.from === id ? r.to : r.from;
        if (other === componentId) continue;
        const c = map.components.find((x) => x.id === other);
        if (c && !affected.has(other)) {
          affected.set(other, { id: other, name: c.name, kind: 'component' });
          targetNames.add(c.name.toLowerCase());
        }
      }
    }
  } else {
    targetNames.add(target.toLowerCase());
  }

  const targetKeywords = buildTargetKeywords([...targetNames]);

  for (const c of map.components) {
    if (affected.has(c.id)) continue;
    if (c.id === componentId) continue;
    const blob = (c.id + ' ' + c.name + ' ' + c.purpose + ' ' + c.responsibilities.join(' ')).toLowerCase();
    if (matchKeywords(blob, targetKeywords)) {
      affected.set(c.id, { id: c.id, name: c.name, kind: 'component' });
    }
  }

  const affectedWorkflows = map.workflows.filter((w) => {
    const blob = (w.name + ' ' + w.description + ' ' + w.components.join(' ')).toLowerCase();
    return matchKeywords(blob, targetKeywords) || w.components.includes(componentId ?? '__none__');
  });

  const relevantInvariants = mentalModel.invariants.filter((inv) => {
    const blob = (inv.statement + ' ' + inv.scope.join(' ')).toLowerCase();
    return matchKeywords(blob, targetKeywords);
  });

  const relevantGuardrails = guardrails.guardrails.filter((g) => {
    const blob = (g.name + ' ' + g.rule + ' ' + g.scope.join(' ')).toLowerCase();
    return matchKeywords(blob, targetKeywords);
  });

  const requiredVerification: string[] = [];
  for (const inv of relevantInvariants) {
    requiredVerification.push(`Invariant ${inv.id}: ${inv.statement}`);
    requiredVerification.push(...inv.verification);
  }
  for (const g of relevantGuardrails) {
    requiredVerification.push(`Guardrail ${g.id}: ${g.rule}`);
  }

  const criticalInvariants = relevantInvariants.filter((i) => i.severity === 'blocking').length;
  const blockingGuardrails = relevantGuardrails.filter((g) => g.severity === 'blocking').length;
  let severity: ImpactReport['severity'] = 'LOW';
  if (affected.size > 4 || affectedWorkflows.length > 2 || criticalInvariants > 0 || blockingGuardrails > 0) {
    severity = 'HIGH';
  } else if (affected.size > 1 || affectedWorkflows.length > 0) {
    severity = 'MEDIUM';
  }

  const evidence: Evidence[] = [
    {
      type: 'source-file',
      location: 'map.json',
      description: 'Relationship graph used for impact tracing'
    }
  ];

  return {
    target: componentId ?? target,
    severity,
    affectedComponents: [...affected.values()].slice(0, 12),
    affectedWorkflows: affectedWorkflows.map((w: Workflow) => w.name).slice(0, 8),
    relevantInvariants: relevantInvariants.map((i) => `${i.id}: ${i.statement}`).slice(0, 8),
    relevantGuardrails: relevantGuardrails.map((g) => `${g.id}: ${g.rule}`).slice(0, 8),
    requiredVerification: [...new Set(requiredVerification)].slice(0, 12),
    evidence
  };
}

interface GuardrailsLike {
  guardrails: Guardrail[];
}

const GENERIC_WORDS = new Set([
  'service', 'the', 'and', 'for', 'with', 'management', 'system', 'flow',
  'application', 'app', 'core', 'module', 'engine', 'api', 'model', 'data'
]);

function buildTargetKeywords(names: string[]): Set<string> {
  const keywords = new Set<string>();
  for (const name of names) {
    const words = name.toLowerCase().split(/[\s\-_]+/).filter((w) => w.length > 1 && !GENERIC_WORDS.has(w));
    for (const w of words) keywords.add(w);
  }
  return keywords;
}

function matchKeywords(blob: string, keywords: Set<string>): boolean {
  for (const keyword of keywords) {
    if (blob.includes(keyword)) return true;
  }
  return false;
}

export function nearestComponents(map: Map, target: string): Component[] {
  const id = resolveComponentId(map, target);
  if (!id) return [];
  const component = map.components.find((c) => c.id === id);
  if (!component) return [];
  const neighbors = map.relationships
    .filter((r) => r.from === id || r.to === id)
    .flatMap((r) => [r.from, r.to])
    .filter((n) => n !== id);
  const result: Component[] = [];
  for (const n of neighbors) {
    const c = map.components.find((x) => x.id === n);
    if (c) result.push(c);
  }
  return result;
}
