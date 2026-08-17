export interface HealthDimension {
  name: string;
  weight: number;
  score: number;
  evidence: HealthEvidence[];
  criticalOverride?: string;
}

export interface HealthEvidence {
  type: 'metric' | 'threshold' | 'violation' | 'coverage' | 'trend';
  label: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
}

export interface HealthReport {
  timestamp: string;
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: HealthDimension[];
  criticalOverrides: string[];
  recommendations: HealthRecommendation[];
}

export interface HealthRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  evidence: string[];
  remediation: string;
}

export interface HealthInput {
  components: number;
  boundaryViolations: number;
  dependencyCycles: number;
  staleComponents: number;
  invariantsTotal: number;
  invariantsProven: number;
  invariantsPartiallyProven: number;
  invariantsNotProven: number;
  testsTotal: number;
  testsLinkedToInvariants: number;
  testEvidenceFreshness: number;
  flakyTests: number;
  driftFindings: number;
  criticalDrift: number;
  secretsFound: number;
  authCoverage: number;
  dependencyVulnerabilities: number;
  retryCoverage: number;
  timeoutCoverage: number;
  incidentFindings: number;
  unownedModules: number;
  totalModules: number;
  unownedDecisions: number;
  totalDecisions: number;
  maxFanOut: number;
  cyclesDetected: number;
  changeConcentration: number;
}

export function computeHealth(input: HealthInput): HealthReport {
  const dimensions: HealthDimension[] = [];
  const criticalOverrides: string[] = [];

  dimensions.push(computeDimension('architecture_consistency', 0.20, [
    { type: 'metric', label: 'boundary_violations', value: input.boundaryViolations, unit: 'count', status: input.boundaryViolations === 0 ? 'good' : input.boundaryViolations < 3 ? 'warning' : 'critical' },
    { type: 'metric', label: 'dependency_cycles', value: input.dependencyCycles, unit: 'count', status: input.dependencyCycles === 0 ? 'good' : 'critical' },
    { type: 'metric', label: 'stale_components', value: input.staleComponents, unit: 'count', status: input.staleComponents < 2 ? 'good' : 'warning' }
  ]));

  dimensions.push(computeDimension('invariant_proof', 0.20, [
    { type: 'coverage', label: 'proven_rate', value: input.invariantsTotal > 0 ? input.invariantsProven / input.invariantsTotal : 1, unit: 'ratio', status: (input.invariantsTotal > 0 ? input.invariantsProven / input.invariantsTotal : 1) >= 0.8 ? 'good' : 'warning' },
    { type: 'coverage', label: 'not_proven', value: input.invariantsNotProven, unit: 'count', status: input.invariantsNotProven === 0 ? 'good' : input.invariantsNotProven < 3 ? 'warning' : 'critical' }
  ]));

  if (input.invariantsNotProven > 0) {
    criticalOverrides.push(`${input.invariantsNotProven} critical invariants have no proof`);
  }

  dimensions.push(computeDimension('test_health', 0.15, [
    { type: 'coverage', label: 'linked_test_rate', value: input.testsTotal > 0 ? input.testsLinkedToInvariants / input.testsTotal : 1, unit: 'ratio', status: 'good' },
    { type: 'metric', label: 'flaky_tests', value: input.flakyTests, unit: 'count', status: input.flakyTests === 0 ? 'good' : 'warning' },
    { type: 'metric', label: 'evidence_freshness', value: input.testEvidenceFreshness, unit: 'days', status: input.testEvidenceFreshness < 7 ? 'good' : 'warning' }
  ]));

  dimensions.push(computeDimension('security_posture', 0.15, [
    { type: 'metric', label: 'secrets_found', value: input.secretsFound, unit: 'count', status: input.secretsFound === 0 ? 'good' : 'critical' },
    { type: 'coverage', label: 'auth_coverage', value: input.authCoverage, unit: 'ratio', status: input.authCoverage >= 0.9 ? 'good' : 'warning' },
    { type: 'metric', label: 'dependency_vulns', value: input.dependencyVulnerabilities, unit: 'count', status: input.dependencyVulnerabilities === 0 ? 'good' : 'warning' }
  ]));

  if (input.secretsFound > 0) {
    criticalOverrides.push(`${input.secretsFound} secret(s) found in source`);
  }

  dimensions.push(computeDimension('drift_risk', 0.10, [
    { type: 'metric', label: 'drift_findings', value: input.driftFindings, unit: 'count', status: input.driftFindings === 0 ? 'good' : 'warning' },
    { type: 'metric', label: 'critical_drift', value: input.criticalDrift, unit: 'count', status: input.criticalDrift === 0 ? 'good' : 'critical' }
  ]));

  dimensions.push(computeDimension('ownership_coverage', 0.10, [
    { type: 'coverage', label: 'module_ownership', value: input.totalModules > 0 ? (input.totalModules - input.unownedModules) / input.totalModules : 1, unit: 'ratio', status: 'good' },
    { type: 'coverage', label: 'decision_ownership', value: input.totalDecisions > 0 ? (input.totalDecisions - input.unownedDecisions) / input.totalDecisions : 1, unit: 'ratio', status: 'good' }
  ]));

  dimensions.push(computeDimension('reliability_posture', 0.10, [
    { type: 'coverage', label: 'retry_coverage', value: input.retryCoverage, unit: 'ratio', status: input.retryCoverage >= 0.8 ? 'good' : 'warning' },
    { type: 'coverage', label: 'timeout_coverage', value: input.timeoutCoverage, unit: 'ratio', status: input.timeoutCoverage >= 0.8 ? 'good' : 'warning' },
    { type: 'metric', label: 'incident_findings', value: input.incidentFindings, unit: 'count', status: input.incidentFindings === 0 ? 'good' : 'warning' }
  ]));

  let overall = 0;
  for (const d of dimensions) {
    overall += d.score * d.weight;
  }

  if (criticalOverrides.length > 0) {
    overall = Math.min(overall, 0.5);
  }

  const grade: HealthReport['grade'] =
    overall >= 0.9 ? 'A' :
    overall >= 0.8 ? 'B' :
    overall >= 0.7 ? 'C' :
    overall >= 0.6 ? 'D' : 'F';

  const recommendations = generateRecommendations(input, dimensions);

  return {
    timestamp: new Date().toISOString(),
    overall,
    grade,
    dimensions,
    criticalOverrides,
    recommendations
  };
}

function computeDimension(name: string, weight: number, evidence: HealthEvidence[]): HealthDimension {
  let score = 0;
  let count = 0;
  for (const e of evidence) {
    if (e.status === 'good') score += 1;
    else if (e.status === 'warning') score += 0.5;
    else score += 0;
    count++;
  }
  return { name, weight, score: count > 0 ? score / count : 1, evidence };
}

function generateRecommendations(input: HealthInput, _dims: HealthDimension[]): HealthRecommendation[] {
  const recs: HealthRecommendation[] = [];

  if (input.secretsFound > 0) {
    recs.push({ priority: 'critical', category: 'security', message: `${input.secretsFound} secret(s) in source must be removed`, evidence: [`secrets: ${input.secretsFound}`], remediation: 'Move to env vars or secret manager' });
  }
  if (input.boundaryViolations > 0) {
    recs.push({ priority: 'high', category: 'architecture', message: `${input.boundaryViolations} boundary violation(s) detected`, evidence: [], remediation: 'Restructure imports to respect layer boundaries' });
  }
  if (input.invariantsNotProven > 0) {
    recs.push({ priority: 'high', category: 'invariants', message: `${input.invariantsNotProven} invariant(s) lack proof`, evidence: [], remediation: 'Add tests or runtime checks' });
  }
  if (input.driftFindings > 0) {
    recs.push({ priority: 'medium', category: 'drift', message: `${input.driftFindings} drift finding(s)`, evidence: [], remediation: 'Reconcile model with repository' });
  }
  if (input.unownedModules > 0) {
    recs.push({ priority: 'low', category: 'ownership', message: `${input.unownedModules} module(s) lack ownership`, evidence: [], remediation: 'Assign owners' });
  }

  return recs;
}
