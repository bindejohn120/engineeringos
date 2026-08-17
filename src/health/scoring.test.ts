import { describe, it, expect } from 'vitest';
import { computeHealth, type HealthInput } from '../health/scoring';

const GOOD_INPUT: HealthInput = {
  components: 10, boundaryViolations: 0, dependencyCycles: 0, staleComponents: 0,
  invariantsTotal: 5, invariantsProven: 5, invariantsPartiallyProven: 0, invariantsNotProven: 0,
  testsTotal: 20, testsLinkedToInvariants: 15, testEvidenceFreshness: 1, flakyTests: 0,
  driftFindings: 0, criticalDrift: 0, secretsFound: 0, authCoverage: 1,
  dependencyVulnerabilities: 0, retryCoverage: 1, timeoutCoverage: 1, incidentFindings: 0,
  unownedModules: 0, totalModules: 10, unownedDecisions: 0, totalDecisions: 5,
  maxFanOut: 3, cyclesDetected: 0, changeConcentration: 0
};

const BAD_INPUT: HealthInput = {
  components: 10, boundaryViolations: 5, dependencyCycles: 2, staleComponents: 3,
  invariantsTotal: 10, invariantsProven: 2, invariantsPartiallyProven: 3, invariantsNotProven: 5,
  testsTotal: 5, testsLinkedToInvariants: 1, testEvidenceFreshness: 30, flakyTests: 4,
  driftFindings: 8, criticalDrift: 3, secretsFound: 2, authCoverage: 0.3,
  dependencyVulnerabilities: 5, retryCoverage: 0.2, timeoutCoverage: 0.1, incidentFindings: 3,
  unownedModules: 5, totalModules: 10, unownedDecisions: 3, totalDecisions: 5,
  maxFanOut: 15, cyclesDetected: 4, changeConcentration: 0.9
};

describe('health scoring', () => {
  it('gives high score for healthy input', () => {
    const report = computeHealth(GOOD_INPUT);
    expect(report.overall).toBeGreaterThan(0.8);
    expect(['A', 'B']).toContain(report.grade);
    expect(report.criticalOverrides).toHaveLength(0);
    expect(report.dimensions).toHaveLength(7);
  });

  it('gives low score for unhealthy input', () => {
    const report = computeHealth(BAD_INPUT);
    expect(report.overall).toBeLessThan(0.6);
    expect(['D', 'F']).toContain(report.grade);
    expect(report.criticalOverrides.length).toBeGreaterThan(0);
  });

  it('critical overrides cap the score', () => {
    const input = { ...GOOD_INPUT, secretsFound: 1 };
    const report = computeHealth(input);
    expect(report.overall).toBeLessThanOrEqual(0.5);
    expect(report.criticalOverrides.length).toBeGreaterThan(0);
  });

  it('generates recommendations', () => {
    const report = computeHealth(BAD_INPUT);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendations.some(r => r.priority === 'critical')).toBe(true);
  });
});
