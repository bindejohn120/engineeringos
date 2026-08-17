import type {
  Guardrail,
  Map,
  MentalModel,
  VerificationReport,
  VerificationResult,
  VerificationVerdict
} from '../core/types';
import { aggregateVerdicts } from '../core/knowledge';
import type { GuardrailEngineResult } from '../guardrails/engine';
import type { DriftReport } from '../core/types';
import { sourceLocationsExist } from '../map/engine';

export interface VerificationInput {
  map: Map;
  mentalModel: MentalModel;
  guardrails: Guardrail[];
  files: string[];
  guardrailEngine: GuardrailEngineResult;
  drift: DriftReport;
}

export function verifyRequirements(input: Pick<VerificationInput, 'map'>): VerificationResult {
  const reqs = input.map.requirements;
  const criticalOpen = reqs.filter((r) => r.priority === 'critical' && r.status !== 'verified' && r.status !== 'implemented');
  const implemented = reqs.filter((r) => r.status === 'implemented' || r.status === 'verified').length;

  const evidence: string[] = [];
  const notVerified: string[] = [];

  if (reqs.length === 0) {
    return { check: 'Requirements', verdict: 'REVIEW', evidence: ['No requirements captured in the map.'], notVerified: ['requirement coverage'] };
  }

  evidence.push(`${reqs.length} requirements tracked; ${implemented} implemented or verified.`);
  for (const r of criticalOpen.slice(0, 5)) {
    notVerified.push(`${r.id}: ${r.text}`);
  }

  const verdict: VerificationVerdict = criticalOpen.length > 0 ? 'REVIEW' : 'PASS';
  return { check: 'Requirements', verdict, evidence, notVerified };
}

export function verifyArchitecture(input: Pick<VerificationInput, 'map' | 'files'>): VerificationResult {
  const { map, files } = input;
  const evidence: string[] = [];
  const notVerified: string[] = [];

  const withLocations = map.components.filter((c) => c.sourceLocations.length > 0);
  const resolved = withLocations.filter((c) => sourceLocationsExist(files, c.sourceLocations));
  evidence.push(`${resolved.length}/${withLocations.length} components have source locations that resolve to files.`);
  const orphanRelationships = map.relationships.filter((r) => {
    const known = new Set([
      ...map.components.map((c) => c.id),
      ...map.services.map((s) => s.id),
      ...map.dataStores.map((d) => d.id),
      ...map.externalSystems.map((e) => e.id)
    ]);
    return !known.has(r.from) || !known.has(r.to);
  });
  if (orphanRelationships.length > 0) {
    notVerified.push(`${orphanRelationships.length} relationships reference unknown endpoints.`);
    return { check: 'Architecture', verdict: 'REVIEW', evidence, notVerified };
  }

  if (withLocations.length > 0 && resolved.length < withLocations.length) {
    notVerified.push(`${withLocations.length - resolved.length} components have unresolvable sourceLocations.`);
    return { check: 'Architecture', verdict: 'REVIEW', evidence, notVerified };
  }

  return { check: 'Architecture', verdict: 'PASS', evidence, notVerified };
}

export function verifyGuardrails(input: Pick<VerificationInput, 'guardrailEngine'>): VerificationResult {
  const { guardrailEngine } = input;
  const evidence: string[] = [`${guardrailEngine.results.length} guardrails evaluated.`];
  const notVerified: string[] = [];
  let verdict: VerificationVerdict = 'PASS';

  for (const result of guardrailEngine.results) {
    if (result.status === 'pass') {
      evidence.push(`✓ ${result.ruleId} ${result.ruleName}`);
    } else {
      notVerified.push(`${result.ruleId} ${result.ruleName} (${result.signals.length} signal(s))`);
      if (result.severity === 'blocking') verdict = 'BLOCK';
      else if (verdict !== 'BLOCK') verdict = 'REVIEW';
    }
  }
  return { check: 'Guardrails', verdict, evidence, notVerified };
}

export function verifyInvariants(input: Pick<VerificationInput, 'mentalModel'>): VerificationResult {
  const invariants = input.mentalModel.invariants;
  const evidence: string[] = [];
  const notVerified: string[] = [];

  if (invariants.length === 0) {
    return { check: 'Invariants', verdict: 'REVIEW', evidence: ['No invariants captured.'], notVerified: ['invariant coverage'] };
  }

  const withVerification = invariants.filter((i) => i.verification.length > 0 || i.enforcement.length > 0);
  evidence.push(`${invariants.length} invariants captured; ${withVerification.length} have enforcement or verification plans.`);

  for (const i of invariants) {
    if (i.verification.length === 0 && i.enforcement.length === 0) {
      notVerified.push(`${i.id}: ${i.statement} (no enforcement or verification plan)`);
    }
  }
  const verdict: VerificationVerdict = notVerified.length > 0 ? 'REVIEW' : 'PASS';
  return { check: 'Invariants', verdict, evidence, notVerified };
}

export function verifyModelConsistency(input: Pick<VerificationInput, 'mentalModel'>): VerificationResult {
  const { mentalModel } = input;
  const evidence: string[] = [];
  const notVerified: string[] = [];

  const assumptions = mentalModel.assumptions.filter((a) => a.confidence !== undefined && a.confidence >= 0.9);
  const noConfidence = mentalModel.unknowns.filter((u) => u.status === 'unresolved');
  evidence.push(`Model tracks ${mentalModel.assumptions.length} assumptions and ${mentalModel.unknowns.length} unknowns.`);

  for (const a of assumptions) {
    notVerified.push(`Assumption ${a.id} has confidence ${a.confidence} — ensure it is not presented as fact.`);
  }
  for (const u of noConfidence.slice(0, 3)) {
    notVerified.push(`Unknown ${u.id} is unresolved.`);
  }

  const verdict: VerificationVerdict = assumptions.length > 0 ? 'REVIEW' : 'PASS';
  return { check: 'Model Consistency', verdict, evidence, notVerified };
}

export function runVerification(input: VerificationInput): VerificationReport {
  const results = [
    verifyRequirements(input),
    verifyArchitecture(input),
    verifyGuardrails(input),
    verifyInvariants(input),
    verifyModelConsistency(input)
  ];

  for (const finding of input.drift.findings) {
    results.push({
      check: `Drift: ${finding.title}`,
      verdict: finding.severity === 'blocking' ? 'BLOCK' : finding.severity === 'warning' ? 'REVIEW' : 'PASS',
      evidence: finding.evidence,
      notVerified: [finding.description]
    });
  }

  const overall = aggregateVerdicts(results.map((r) => r.verdict));
  return {
    overall,
    results,
    completedAt: new Date().toISOString()
  };
}
