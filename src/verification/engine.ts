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
  tests?: string[];
  git?: { branch: string | null; currentCommit: string | null };
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

export function verifyTDD(input: Pick<VerificationInput, 'files' | 'tests'>): VerificationResult {
  const { files } = input;
  const evidence: string[] = [];
  const notVerified: string[] = [];

  const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.java', '.go', '.rb', '.php', '.cs'];
  const testExtensions = ['.test.ts', '.test.js', '.spec.ts', '.spec.js'];

  const sourceFiles = files.filter((f) => sourceExtensions.some((ext) => f.endsWith(ext)) && !f.includes('node_modules'));
  const testFiles = files.filter((f) => testExtensions.some((ext) => f.endsWith(ext)) && !f.includes('node_modules'));

  if (sourceFiles.length === 0) {
    return { check: 'TDD', verdict: 'PASS', evidence: ['No source files to check.'], notVerified: [] };
  }

  if (input.tests === undefined) {
    return { check: 'TDD', verdict: 'PASS', evidence: [`${sourceFiles.length} source files. TDD check not configured (no test data provided).`], notVerified: [] };
  }

  evidence.push(`${sourceFiles.length} source files, ${testFiles.length} test files.`);

  const untested: string[] = [];
  for (const src of sourceFiles) {
    const base = src.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
    const hasTest = testFiles.some((t) => t.startsWith(base));
    if (!hasTest) untested.push(src);
  }

  if (untested.length > 0) {
    for (const f of untested.slice(0, 5)) {
      notVerified.push(`No test file for: ${f}`);
    }
    if (untested.length > 5) {
      notVerified.push(`... and ${untested.length - 5} more files without tests.`);
    }
  }

  evidence.push(`${sourceFiles.length - untested.length}/${sourceFiles.length} source files have tests.`);

  const testRatio = testFiles.length / sourceFiles.length;
  if (untested.length > 0) {
    return { check: 'TDD', verdict: 'REVIEW', evidence, notVerified };
  }
  if (testRatio < 0.5) {
    return { check: 'TDD', verdict: 'REVIEW', evidence: [...evidence, 'Low test-to-source ratio.'], notVerified: [] };
  }
  return { check: 'TDD', verdict: 'PASS', evidence, notVerified };
}

export function verifyBranch(input: Pick<VerificationInput, 'git'>): VerificationResult | null {
  if (!input.git) return null;
  const { branch, currentCommit } = input.git;
  const evidence: string[] = [];
  const notVerified: string[] = [];

  if (!branch) {
    return { check: 'Branch', verdict: 'REVIEW', evidence: ['Not on a named branch.'], notVerified: ['branch status'] };
  }

  evidence.push(`On branch: ${branch}`);
  if (currentCommit) evidence.push(`HEAD: ${currentCommit.slice(0, 8)}`);

  const isMain = branch === 'main' || branch === 'master' || branch === 'develop';
  if (isMain) {
    return { check: 'Branch', verdict: 'REVIEW', evidence: [...evidence, 'Working directly on main branch.'], notVerified: ['isolated worktree for changes'] };
  }

  return { check: 'Branch', verdict: 'PASS', evidence, notVerified };
}

export function runVerification(input: VerificationInput): VerificationReport {
  const results = [
    verifyRequirements(input),
    verifyArchitecture(input),
    verifyGuardrails(input),
    verifyInvariants(input),
    verifyModelConsistency(input),
    verifyTDD(input),
  ];

  const branchResult = verifyBranch(input);
  if (branchResult) results.push(branchResult);

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
