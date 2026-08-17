import type {
  Map,
  MentalModel,
  Guardrails,
  Blueprint,
  Component,
} from '../core/types';

export interface QualityCheck {
  id: string;
  name: string;
  category: 'completeness' | 'consistency' | 'traceability' | 'coverage';
  status: 'pass' | 'warn' | 'fail';
  message: string;
  weight: number;
}

export interface ArtifactQualityScore {
  artifact: 'map' | 'mental-model' | 'guardrails' | 'blueprint' | 'overall';
  score: number;
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  checks: QualityCheck[];
  recommendations: string[];
}

function computeGrade(score: number): ArtifactQualityScore['grade'] {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 50) return 'C-';
  if (score >= 40) return 'D';
  return 'F';
}

function computeScore(checks: QualityCheck[]): number {
  if (checks.length === 0) return 100;
  let totalWeight = 0;
  let earnedWeight = 0;
  for (const c of checks) {
    totalWeight += c.weight;
    if (c.status === 'pass') {
      earnedWeight += c.weight;
    } else if (c.status === 'warn') {
      earnedWeight += c.weight * 0.5;
    }
  }
  if (totalWeight === 0) return 100;
  return Math.round((earnedWeight / totalWeight) * 100);
}

function buildResult(
  artifact: ArtifactQualityScore['artifact'],
  checks: QualityCheck[],
): ArtifactQualityScore {
  const score = computeScore(checks);
  const recommendations: string[] = [];
  for (const c of checks) {
    if (c.status !== 'pass') {
      recommendations.push(c.message);
    }
  }
  return { artifact, score, grade: computeGrade(score), checks, recommendations };
}

function getAllComponentIds(map: Map): Set<string> {
  const ids = new Set<string>();
  for (const c of map.components) ids.add(c.id);
  for (const s of map.services) ids.add(s.id);
  for (const d of map.dataStores) ids.add(d.id);
  for (const e of map.externalSystems) ids.add(e.id);
  return ids;
}

function getAllComponentPurposes(map: Map): Component[] {
  const all: Component[] = [...map.components];
  for (const s of map.services) {
    all.push({
      id: s.id,
      name: s.name,
      purpose: s.purpose,
      responsibilities: s.responsibilities,
      inputs: [],
      outputs: [],
      dependencies: [],
      dependents: [],
      interfaces: [],
      failureModes: s.failureModes,
      sourceLocations: s.sourceLocations,
    });
  }
  return all;
}

// ─── Map Quality ─────────────────────────────────────────────────────────────

export function evaluateMapQuality(map: Map): ArtifactQualityScore {
  const checks: QualityCheck[] = [];
  const allIds = getAllComponentIds(map);
  const allComponents: Component[] = getAllComponentPurposes(map);

  // MAP-C01: Every critical requirement has at least one affected component
  {
    const criticalReqs = map.requirements.filter(r => r.priority === 'critical');
    const orphaned = criticalReqs.filter(r => !r.affectedComponents || r.affectedComponents.length === 0);
    checks.push({
      id: 'MAP-C01',
      name: 'Critical requirements have affected components',
      category: 'completeness',
      status: orphaned.length === 0 ? 'pass' : 'fail',
      message: orphaned.length === 0
        ? 'All critical requirements have affected components'
        : `Critical requirements missing affected components: ${orphaned.map(r => r.id).join(', ')}`,
      weight: 1.0,
    });
  }

  // MAP-C02: Every component has a purpose > 10 chars
  {
    const emptyPurpose = allComponents.filter(c => !c.purpose || c.purpose.trim().length <= 10);
    checks.push({
      id: 'MAP-C02',
      name: 'Components have meaningful purpose',
      category: 'completeness',
      status: emptyPurpose.length === 0 ? 'pass' : 'fail',
      message: emptyPurpose.length === 0
        ? 'All components have meaningful purpose descriptions'
        : `Components with missing or short purpose: ${emptyPurpose.map(c => c.id).join(', ')}`,
      weight: 0.8,
    });
  }

  // MAP-C03: At least 80% of components have failure modes defined
  {
    if (allComponents.length === 0) {
      checks.push({
        id: 'MAP-C03',
        name: 'Component failure modes defined',
        category: 'completeness',
        status: 'warn',
        message: 'No components defined to check failure modes',
        weight: 0.7,
      });
    } else {
      const withoutFM = allComponents.filter(c => !c.failureModes || c.failureModes.length === 0);
      const pct = ((allComponents.length - withoutFM.length) / allComponents.length) * 100;
      checks.push({
        id: 'MAP-C03',
        name: 'Component failure modes defined',
        category: 'completeness',
        status: pct >= 80 ? 'pass' : 'fail',
        message: pct >= 80
          ? `${Math.round(pct)}% of components have failure modes`
          : `Only ${Math.round(pct)}% of components have failure modes. Missing: ${withoutFM.map(c => c.id).join(', ')}`,
        weight: 0.7,
      });
    }
  }

  // MAP-C04: Every component has at least one responsibility
  {
    const noResponsibilities = allComponents.filter(c => !c.responsibilities || c.responsibilities.length === 0);
    checks.push({
      id: 'MAP-C04',
      name: 'Components have responsibilities',
      category: 'completeness',
      status: noResponsibilities.length === 0 ? 'pass' : 'fail',
      message: noResponsibilities.length === 0
        ? 'All components have at least one responsibility'
        : `Components without responsibilities: ${noResponsibilities.map(c => c.id).join(', ')}`,
      weight: 0.8,
    });
  }

  // MAP-C05: Components have sourceLocations (warn if empty)
  {
    const noSources = allComponents.filter(c => !c.sourceLocations || c.sourceLocations.length === 0);
    checks.push({
      id: 'MAP-C05',
      name: 'Components have source locations',
      category: 'completeness',
      status: noSources.length === 0 ? 'pass' : noSources.length <= allComponents.length * 0.5 ? 'warn' : 'fail',
      message: noSources.length === 0
        ? 'All components have source locations'
        : `${noSources.length}/${allComponents.length} components missing source locations: ${noSources.map(c => c.id).join(', ')}`,
      weight: 0.5,
    });
  }

  // MAP-S01: All relationship endpoints reference existing component IDs
  {
    const broken: string[] = [];
    for (const rel of map.relationships) {
      if (!allIds.has(rel.from)) broken.push(`${rel.id}: from=${rel.from}`);
      if (!allIds.has(rel.to)) broken.push(`${rel.id}: to=${rel.to}`);
    }
    checks.push({
      id: 'MAP-S01',
      name: 'Relationship endpoints are valid',
      category: 'consistency',
      status: broken.length === 0 ? 'pass' : 'fail',
      message: broken.length === 0
        ? 'All relationship endpoints reference existing components'
        : `Broken relationship endpoints: ${broken.join('; ')}`,
      weight: 1.0,
    });
  }

  // MAP-S02: No duplicate component IDs
  {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const id of allIds) {
      if (seen.has(id)) dupes.push(id);
      seen.add(id);
    }
    // Also check within raw arrays
    const rawIds = [
      ...map.components.map(c => c.id),
      ...map.services.map(s => s.id),
      ...map.dataStores.map(d => d.id),
      ...map.externalSystems.map(e => e.id),
    ];
    const rawSeen = new Set<string>();
    for (const id of rawIds) {
      if (rawSeen.has(id) && !dupes.includes(id)) dupes.push(id);
      rawSeen.add(id);
    }
    checks.push({
      id: 'MAP-S02',
      name: 'No duplicate component IDs',
      category: 'consistency',
      status: dupes.length === 0 ? 'pass' : 'fail',
      message: dupes.length === 0
        ? 'No duplicate component IDs found'
        : `Duplicate component IDs: ${dupes.join(', ')}`,
      weight: 1.0,
    });
  }

  // MAP-S03: No self-referencing relationships
  {
    const selfRefs = map.relationships.filter(r => r.from === r.to);
    checks.push({
      id: 'MAP-S03',
      name: 'No self-referencing relationships',
      category: 'consistency',
      status: selfRefs.length === 0 ? 'pass' : 'warn',
      message: selfRefs.length === 0
        ? 'No self-referencing relationships'
        : `Self-referencing relationships: ${selfRefs.map(r => r.id).join(', ')}`,
      weight: 0.6,
    });
  }

  // MAP-T01: Every requirement traces to at least one component
  {
    const orphanedReqs = map.requirements.filter(r => !r.affectedComponents || r.affectedComponents.length === 0);
    checks.push({
      id: 'MAP-T01',
      name: 'Requirements trace to components',
      category: 'traceability',
      status: orphanedReqs.length === 0 ? 'pass' : 'fail',
      message: orphanedReqs.length === 0
        ? 'Every requirement traces to at least one component'
        : `Requirements without component traceability: ${orphanedReqs.map(r => r.id).join(', ')}`,
      weight: 0.9,
    });
  }

  // MAP-T02: Every workflow references real components
  {
    const brokenWorkflows: string[] = [];
    for (const wf of map.workflows) {
      const bad = (wf.components || []).filter(cid => !allIds.has(cid));
      if (bad.length > 0) brokenWorkflows.push(`${wf.id}: ${bad.join(', ')}`);
    }
    checks.push({
      id: 'MAP-T02',
      name: 'Workflows reference real components',
      category: 'traceability',
      status: brokenWorkflows.length === 0 ? 'pass' : 'fail',
      message: brokenWorkflows.length === 0
        ? 'All workflows reference real components'
        : `Workflows with invalid component refs: ${brokenWorkflows.join('; ')}`,
      weight: 0.8,
    });
  }

  // MAP-V01: At least 3 environments defined
  {
    const count = map.environments?.length ?? 0;
    checks.push({
      id: 'MAP-V01',
      name: 'Sufficient environments defined',
      category: 'coverage',
      status: count >= 3 ? 'pass' : count >= 1 ? 'warn' : 'fail',
      message: count >= 3
        ? `${count} environments defined`
        : `Only ${count} environment(s) defined (minimum recommended: 3)`,
      weight: 0.5,
    });
  }

  // MAP-V02: Infrastructure entries have details
  {
    const infra = map.infrastructure ?? [];
    const emptyDetails = infra.filter(i => !i.details || i.details.length === 0);
    checks.push({
      id: 'MAP-V02',
      name: 'Infrastructure entries have details',
      category: 'coverage',
      status: infra.length === 0
        ? 'warn'
        : emptyDetails.length === 0
          ? 'pass'
          : 'warn',
      message: infra.length === 0
        ? 'No infrastructure entries defined'
        : emptyDetails.length === 0
          ? 'All infrastructure entries have details'
          : `Infrastructure entries missing details: ${emptyDetails.map(i => i.id).join(', ')}`,
      weight: 0.4,
    });
  }

  return buildResult('map', checks);
}

// ─── Mental Model Quality ────────────────────────────────────────────────────

export function evaluateMentalModelQuality(model: MentalModel): ArtifactQualityScore {
  const checks: QualityCheck[] = [];

  // MM-C01: Every invariant has enforcement defined
  {
    const missing = model.invariants.filter(i => !i.enforcement || i.enforcement.length === 0);
    checks.push({
      id: 'MM-C01',
      name: 'Invariants have enforcement',
      category: 'completeness',
      status: missing.length === 0 ? 'pass' : 'fail',
      message: missing.length === 0
        ? 'All invariants have enforcement definitions'
        : `Invariants missing enforcement: ${missing.map(i => i.id).join(', ')}`,
      weight: 1.0,
    });
  }

  // MM-C02: Every invariant has verification defined
  {
    const missing = model.invariants.filter(i => !i.verification || i.verification.length === 0);
    checks.push({
      id: 'MM-C02',
      name: 'Invariants have verification',
      category: 'completeness',
      status: missing.length === 0 ? 'pass' : 'fail',
      message: missing.length === 0
        ? 'All invariants have verification definitions'
        : `Invariants missing verification: ${missing.map(i => i.id).join(', ')}`,
      weight: 0.9,
    });
  }

  // MM-C03: Every blocking invariant has scope
  {
    const blocking = model.invariants.filter(i => i.severity === 'blocking');
    const missingScope = blocking.filter(i => !i.scope || i.scope.length === 0);
    checks.push({
      id: 'MM-C03',
      name: 'Blocking invariants have scope',
      category: 'completeness',
      status: missingScope.length === 0 ? 'pass' : 'fail',
      message: missingScope.length === 0
        ? 'All blocking invariants have scope defined'
        : `Blocking invariants missing scope: ${missingScope.map(i => i.id).join(', ')}`,
      weight: 0.9,
    });
  }

  // MM-C04: State machines define invalid transitions
  {
    const incomplete = model.stateMachines.filter(
      sm => !sm.invalidTransitions || sm.invalidTransitions.length === 0,
    );
    checks.push({
      id: 'MM-C04',
      name: 'State machines define invalid transitions',
      category: 'completeness',
      status: model.stateMachines.length === 0
        ? 'warn'
        : incomplete.length === 0
          ? 'pass'
          : 'warn',
      message: model.stateMachines.length === 0
        ? 'No state machines defined'
        : incomplete.length === 0
          ? 'All state machines define invalid transitions'
          : `State machines missing invalid transitions: ${incomplete.map(sm => sm.entity).join(', ')}`,
      weight: 0.6,
    });
  }

  // MM-C05: At least 3 business rules defined
  {
    const count = model.businessRules.length;
    checks.push({
      id: 'MM-C05',
      name: 'Sufficient business rules',
      category: 'completeness',
      status: count >= 3 ? 'pass' : count >= 1 ? 'warn' : 'fail',
      message: count >= 3
        ? `${count} business rules defined`
        : `Only ${count} business rule(s) defined (minimum recommended: 3)`,
      weight: 0.7,
    });
  }

  // MM-S01: Every risk has a mitigation strategy
  {
    const unmitigated = model.risks.filter(r => !r.mitigation || r.mitigation.trim().length === 0);
    checks.push({
      id: 'MM-S01',
      name: 'Risks have mitigation',
      category: 'consistency',
      status: unmitigated.length === 0 ? 'pass' : 'fail',
      message: unmitigated.length === 0
        ? 'All risks have mitigation strategies'
        : `Risks without mitigation: ${unmitigated.map(r => r.id).join(', ')}`,
      weight: 0.8,
    });
  }

  // MM-S02: No duplicate invariant IDs
  {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const inv of model.invariants) {
      if (seen.has(inv.id)) dupes.push(inv.id);
      seen.add(inv.id);
    }
    checks.push({
      id: 'MM-S02',
      name: 'No duplicate invariant IDs',
      category: 'consistency',
      status: dupes.length === 0 ? 'pass' : 'fail',
      message: dupes.length === 0
        ? 'No duplicate invariant IDs'
        : `Duplicate invariant IDs: ${dupes.join(', ')}`,
      weight: 0.7,
    });
  }

  // MM-T01: High-impact assumptions have evidence
  {
    const highImpact = model.assumptions.filter(
      a => a.impact && a.impact.toLowerCase().includes('high'),
    );
    const noEvidence = highImpact.filter(a => !a.evidence || a.evidence.length === 0);
    checks.push({
      id: 'MM-T01',
      name: 'High-impact assumptions have evidence',
      category: 'traceability',
      status: noEvidence.length === 0 ? 'pass' : 'warn',
      message: noEvidence.length === 0
        ? 'All high-impact assumptions have evidence'
        : `High-impact assumptions without evidence: ${noEvidence.map(a => a.id).join(', ')}`,
      weight: 0.6,
    });
  }

  // MM-T02: Unknowns have blocks defined
  {
    const noBlocks = model.unknowns.filter(u => !u.blocks || u.blocks.length === 0);
    checks.push({
      id: 'MM-T02',
      name: 'Unknowns have blocks defined',
      category: 'traceability',
      status: noBlocks.length === 0 ? 'pass' : 'warn',
      message: noBlocks.length === 0
        ? 'All unknowns have blocks defined'
        : `Unknowns without blocks: ${noBlocks.map(u => u.id).join(', ')}`,
      weight: 0.5,
    });
  }

  // MM-V01: At least 3 failure modes defined
  {
    const count = model.failureModes.length;
    checks.push({
      id: 'MM-V01',
      name: 'Sufficient failure modes',
      category: 'coverage',
      status: count >= 3 ? 'pass' : count >= 1 ? 'warn' : 'fail',
      message: count >= 3
        ? `${count} failure modes defined`
        : `Only ${count} failure mode(s) defined (minimum recommended: 3)`,
      weight: 0.8,
    });
  }

  // MM-V02: Recovery strategies exist for blocking failure modes
  {
    const blockingFM = model.failureModes.filter(f => f.severity === 'blocking');
    const fmIdsWithRecovery = new Set(model.recoveryStrategies.map(r => r.appliesTo));
    const uncovered = blockingFM.filter(f => !fmIdsWithRecovery.has(f.id));
    checks.push({
      id: 'MM-V02',
      name: 'Blocking failure modes have recovery strategies',
      category: 'coverage',
      status: uncovered.length === 0 ? 'pass' : 'fail',
      message: uncovered.length === 0
        ? 'All blocking failure modes have recovery strategies'
        : `Blocking failure modes without recovery: ${uncovered.map(f => f.id).join(', ')}`,
      weight: 0.8,
    });
  }

  // MM-V03: Entities cover primary users
  {
    const primaryUsers = model.systemUnderstanding?.primaryUsers ?? [];
    const entityNames = new Set(model.entities.map(e => e.name.toLowerCase()));
    const uncovered = primaryUsers.filter(u => !entityNames.has(u.toLowerCase()));
    checks.push({
      id: 'MM-V03',
      name: 'Entities cover primary users',
      category: 'coverage',
      status: uncovered.length === 0 ? 'pass' : 'warn',
      message: uncovered.length === 0
        ? 'Primary users are covered by entities'
        : `Primary users not represented as entities: ${uncovered.join(', ')}`,
      weight: 0.5,
    });
  }

  return buildResult('mental-model', checks);
}

// ─── Guardrails Quality ──────────────────────────────────────────────────────

export function evaluateGuardrailsQuality(
  guardrails: Guardrails,
  model: MentalModel,
): ArtifactQualityScore {
  const checks: QualityCheck[] = [];
  const grs = guardrails.guardrails ?? [];

  // GR-C01: Every blocking invariant scope has at least one guardrail covering it
  {
    const blockingInvariants = model.invariants.filter(i => i.severity === 'blocking');
    const uncovered: string[] = [];
    for (const inv of blockingInvariants) {
      const hasGuardrail = grs.some(g =>
        g.scope.some(s => inv.scope.some(is_ => s === is_ || s.includes(is_) || is_.includes(s))),
      );
      if (!hasGuardrail) uncovered.push(inv.id);
    }
    checks.push({
      id: 'GR-C01',
      name: 'Blocking invariant scopes covered by guardrails',
      category: 'completeness',
      status: uncovered.length === 0 ? 'pass' : 'fail',
      message: uncovered.length === 0
        ? 'All blocking invariant scopes have guardrail coverage'
        : `Blocking invariants without guardrail coverage: ${uncovered.join(', ')}`,
      weight: 1.0,
    });
  }

  // GR-C02: Guardrails cover src/**
  {
    const hasSrcCoverage = grs.some(g =>
      g.scope.some(s => s.includes('src')),
    );
    checks.push({
      id: 'GR-C02',
      name: 'Guardrails cover src/**',
      category: 'completeness',
      status: hasSrcCoverage ? 'pass' : 'warn',
      message: hasSrcCoverage
        ? 'Guardrails cover src/** paths'
        : 'No guardrails have scope covering src/**',
      weight: 0.7,
    });
  }

  // GR-C03: At least 10 guardrails defined
  {
    const count = grs.length;
    checks.push({
      id: 'GR-C03',
      name: 'Sufficient guardrails defined',
      category: 'completeness',
      status: count >= 10 ? 'pass' : count >= 5 ? 'warn' : 'fail',
      message: count >= 10
        ? `${count} guardrails defined`
        : `Only ${count} guardrail(s) defined (minimum recommended: 10)`,
      weight: 0.8,
    });
  }

  // GR-S01: No duplicate guardrail IDs
  {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const g of grs) {
      if (seen.has(g.id)) dupes.push(g.id);
      seen.add(g.id);
    }
    checks.push({
      id: 'GR-S01',
      name: 'No duplicate guardrail IDs',
      category: 'consistency',
      status: dupes.length === 0 ? 'pass' : 'fail',
      message: dupes.length === 0
        ? 'No duplicate guardrail IDs'
        : `Duplicate guardrail IDs: ${dupes.join(', ')}`,
      weight: 0.7,
    });
  }

  // GR-S02: No duplicate guardrail names
  {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const g of grs) {
      const name = g.name?.toLowerCase().trim();
      if (name && seen.has(name)) dupes.push(g.name);
      if (name) seen.add(name);
    }
    checks.push({
      id: 'GR-S02',
      name: 'No duplicate guardrail names',
      category: 'consistency',
      status: dupes.length === 0 ? 'pass' : 'fail',
      message: dupes.length === 0
        ? 'No duplicate guardrail names'
        : `Duplicate guardrail names: ${dupes.join(', ')}`,
      weight: 0.5,
    });
  }

  // GR-T01: Security guardrails exist (at least 3)
  {
    const securityKw = ['security', 'auth', 'permission', 'encrypt', 'secret', 'token', 'xss', 'injection', 'csrf', 'sanitiz'];
    const securityGrs = grs.filter(g => {
      const combined = `${g.name} ${g.rule} ${g.reason}`.toLowerCase();
      return securityKw.some(kw => combined.includes(kw));
    });
    const count = securityGrs.length;
    checks.push({
      id: 'GR-T01',
      name: 'Security guardrails exist',
      category: 'traceability',
      status: count >= 3 ? 'pass' : count >= 1 ? 'warn' : 'fail',
      message: count >= 3
        ? `${count} security guardrails found`
        : `Only ${count} security guardrail(s) found (minimum recommended: 3)`,
      weight: 0.9,
    });
  }

  return buildResult('guardrails', checks);
}

// ─── Blueprint Quality ───────────────────────────────────────────────────────

export function evaluateBlueprintQuality(blueprint: Blueprint): ArtifactQualityScore {
  const checks: QualityCheck[] = [];
  const sections = blueprint.sections ?? [];

  // BP-C01: At least 12 sections present
  {
    const count = sections.length;
    checks.push({
      id: 'BP-C01',
      name: 'Sufficient blueprint sections',
      category: 'completeness',
      status: count >= 12 ? 'pass' : count >= 8 ? 'warn' : 'fail',
      message: count >= 12
        ? `${count} sections present`
        : `Only ${count} section(s) present (minimum recommended: 12)`,
      weight: 0.8,
    });
  }

  // BP-C02: Every section has > 2 directives
  {
    const thinSections = sections.filter(
      s => !s.directives || s.directives.length <= 2,
    );
    checks.push({
      id: 'BP-C02',
      name: 'Sections have sufficient directives',
      category: 'completeness',
      status: sections.length === 0
        ? 'warn'
        : thinSections.length === 0
          ? 'pass'
          : thinSections.length <= sections.length * 0.3
            ? 'warn'
            : 'fail',
      message: sections.length === 0
        ? 'No sections defined'
        : thinSections.length === 0
          ? 'All sections have more than 2 directives'
          : `Sections with ≤2 directives: ${thinSections.map(s => s.id).join(', ')}`,
      weight: 0.7,
    });
  }

  // BP-C03: Tech stack fields are non-empty
  {
    const ts = blueprint.techStack;
    const emptyFields: string[] = [];
    if (!ts?.language || ts.language.trim().length === 0) emptyFields.push('language');
    if (!ts?.runtime || ts.runtime.trim().length === 0) emptyFields.push('runtime');
    if (!ts?.framework || ts.framework.trim().length === 0) emptyFields.push('framework');
    if (!ts?.database || ts.database.trim().length === 0) emptyFields.push('database');
    checks.push({
      id: 'BP-C03',
      name: 'Tech stack fields are non-empty',
      category: 'completeness',
      status: emptyFields.length === 0 ? 'pass' : 'warn',
      message: emptyFields.length === 0
        ? 'All tech stack fields are populated'
        : `Empty tech stack fields: ${emptyFields.join(', ')}`,
      weight: 0.6,
    });
  }

  // BP-C04: Summary is > 50 chars
  {
    const len = blueprint.summary?.trim().length ?? 0;
    checks.push({
      id: 'BP-C04',
      name: 'Summary is meaningful',
      category: 'completeness',
      status: len > 50 ? 'pass' : len > 0 ? 'warn' : 'fail',
      message: len > 50
        ? 'Summary is sufficiently detailed'
        : len > 0
          ? `Summary is only ${len} chars (recommended: >50)`
          : 'Summary is missing or empty',
      weight: 0.5,
    });
  }

  // BP-S01: Architecture style is specified
  {
    const hasStyle = blueprint.architectureStyle && blueprint.architectureStyle.trim().length > 0;
    checks.push({
      id: 'BP-S01',
      name: 'Architecture style specified',
      category: 'consistency',
      status: hasStyle ? 'pass' : 'fail',
      message: hasStyle
        ? `Architecture style: ${blueprint.architectureStyle}`
        : 'Architecture style is not specified',
      weight: 0.7,
    });
  }

  // BP-S02: Security level is specified
  {
    const hasSec = blueprint.securityLevel && blueprint.securityLevel.trim().length > 0;
    checks.push({
      id: 'BP-S02',
      name: 'Security level specified',
      category: 'consistency',
      status: hasSec ? 'pass' : 'fail',
      message: hasSec
        ? `Security level: ${blueprint.securityLevel}`
        : 'Security level is not specified',
      weight: 0.7,
    });
  }

  // BP-T01: Testing section exists with test strategy
  {
    const testingSection = sections.find(
      s => s.title.toLowerCase().includes('test') || s.id.toLowerCase().includes('test'),
    );
    const hasTestStrategy = testingSection
      ? testingSection.directives.some(d => d.toLowerCase().includes('test'))
      : false;
    checks.push({
      id: 'BP-T01',
      name: 'Testing section exists',
      category: 'traceability',
      status: hasTestStrategy ? 'pass' : testingSection ? 'warn' : 'fail',
      message: hasTestStrategy
        ? 'Testing section with test strategy found'
        : testingSection
          ? 'Testing section exists but lacks test strategy directives'
          : 'No testing section found in blueprint',
      weight: 0.7,
    });
  }

  // BP-V01: Roadmap section exists with phases
  {
    const roadmapSection = sections.find(
      s => s.title.toLowerCase().includes('roadmap') || s.id.toLowerCase().includes('roadmap'),
    );
    const hasPhases = roadmapSection
      ? roadmapSection.directives.some(d => d.toLowerCase().includes('phase'))
      : false;
    checks.push({
      id: 'BP-V01',
      name: 'Roadmap section exists',
      category: 'coverage',
      status: hasPhases ? 'pass' : roadmapSection ? 'warn' : 'fail',
      message: hasPhases
        ? 'Roadmap section with phases found'
        : roadmapSection
          ? 'Roadmap section exists but lacks phase directives'
          : 'No roadmap section found in blueprint',
      weight: 0.5,
    });
  }

  return buildResult('blueprint', checks);
}

// ─── Overall Quality ─────────────────────────────────────────────────────────

export function evaluateOverallQuality(
  map: Map,
  model: MentalModel,
  guardrails: Guardrails,
  blueprint: Blueprint,
): ArtifactQualityScore {
  const mapResult = evaluateMapQuality(map);
  const mmResult = evaluateMentalModelQuality(model);
  const grResult = evaluateGuardrailsQuality(guardrails, model);
  const bpResult = evaluateBlueprintQuality(blueprint);

  const allChecks: QualityCheck[] = [
    ...mapResult.checks,
    ...mmResult.checks,
    ...grResult.checks,
    ...bpResult.checks,
  ];

  return buildResult('overall', allChecks);
}
