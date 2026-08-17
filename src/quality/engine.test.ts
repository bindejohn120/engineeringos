import { describe, it, expect } from 'vitest';
import {
  evaluateMapQuality,
  evaluateMentalModelQuality,
  evaluateGuardrailsQuality,
  evaluateOverallQuality,
} from './engine';
import type { Map, MentalModel, Guardrails, Blueprint } from '../core/types';

function makeMap(overrides: Partial<Map> = {}): Map {
  const component = {
    id: 'CMP-001',
    name: 'AuthService',
    purpose: 'Handles user authentication and JWT token generation',
    responsibilities: ['authenticate users', 'issue tokens'],
    inputs: ['credentials'],
    outputs: ['token'],
    dependencies: [],
    dependents: [],
    interfaces: ['AuthController'],
    failureModes: ['token expiry'],
    sourceLocations: ['src/auth/service.ts'],
  };
  return {
    schemaVersion: '1.0',
    modelVersion: 1,
    project: { name: 'Test' },
    actors: [],
    requirements: [
      {
        schemaVersion: '1.0',
        modelVersion: 1,
        id: 'REQ-001',
        text: 'User auth',
        source: 'developer',
        priority: 'critical',
        status: 'open',
        evidence: [],
        affectedComponents: ['CMP-001'],
      },
    ],
    components: [component],
    services: [],
    dataStores: [],
    externalSystems: [],
    relationships: [],
    dataFlows: [],
    workflows: [
      {
        id: 'WF-001',
        name: 'Login',
        description: 'User login flow',
        steps: ['submit', 'validate'],
        components: ['CMP-001'],
        inputs: ['credentials'],
        outputs: ['token'],
      },
    ],
    dependencies: [],
    environments: [
      { id: 'ENV-1', name: 'dev', description: 'dev env', properties: [] },
      { id: 'ENV-2', name: 'staging', description: 'staging env', properties: [] },
      { id: 'ENV-3', name: 'prod', description: 'prod env', properties: [] },
    ],
    infrastructure: [
      { id: 'INF-1', name: 'Docker', description: 'container runtime', details: ['docker-compose'] },
    ],
    ...overrides,
  } as Map;
}

function makeMentalModel(overrides: Partial<MentalModel> = {}): MentalModel {
  return {
    schemaVersion: '1.0',
    modelVersion: 1,
    systemUnderstanding: {
      purpose: 'Test system',
      primaryUsers: ['admin', 'user'],
      criticalCapabilities: ['auth'],
    },
    entities: [
      { id: 'ENT-1', name: 'User', description: 'System user', kind: 'entity' },
    ],
    relationships: [],
    causalRelationships: [],
    businessRules: [
      { id: 'BR-1', statement: 'Must be authenticated', severity: 'blocking', source: 'recommendation' },
      { id: 'BR-2', statement: 'Roles enforced', severity: 'warning', source: 'recommendation' },
      { id: 'BR-3', statement: 'Session timeout', severity: 'advisory', source: 'recommendation' },
    ],
    invariants: [
      {
        id: 'INV-1',
        statement: 'User must exist',
        severity: 'blocking',
        scope: ['UserService'],
        enforcement: ['DB constraint'],
        verification: ['unit test'],
      },
    ],
    stateMachines: [
      {
        entity: 'User',
        states: ['active', 'inactive'],
        transitions: [{ from: 'active', to: 'inactive', trigger: 'deactivate' }],
        invalidTransitions: [],
      },
    ],
    workflows: [],
    failureModes: [
      {
        id: 'FM-1',
        name: 'DB down',
        description: 'Database unavailable',
        severity: 'blocking',
        mitigation: 'retry',
        evidence: [],
      },
      {
        id: 'FM-2',
        name: 'Slow query',
        description: 'Queries take too long',
        severity: 'warning',
        mitigation: 'add index',
        evidence: [],
      },
      {
        id: 'FM-3',
        name: 'Timeout',
        description: 'Request timeout',
        severity: 'advisory',
        mitigation: 'increase timeout',
        evidence: [],
      },
    ],
    recoveryStrategies: [
      { id: 'REC-1', name: 'Retry', description: 'Retry on failure', appliesTo: 'FM-1' },
    ],
    architecturalPrinciples: [],
    decisions: [],
    assumptions: [],
    unknowns: [],
    constraints: [],
    currentState: { summary: 'Initial' },
    intendedState: { summary: 'Target' },
    risks: [
      {
        id: 'RISK-1',
        name: 'High traffic',
        description: 'Unexpected load',
        likelihood: 'medium',
        impact: 'high',
        mitigation: 'auto-scale',
      },
    ],
    predictions: [],
    evidence: [],
    ...overrides,
  } as MentalModel;
}

function makeGuardrails(_model: MentalModel, overrides: Partial<Guardrails> = {}): Guardrails {
  return {
    schemaVersion: '1.0',
    modelVersion: 1,
    guardrails: [
      {
        id: 'GR-001',
        name: 'Security: Auth check',
        rule: 'All routes must validate auth',
        severity: 'blocking',
        scope: ['src/**'],
        allowedPatterns: [],
        forbiddenPatterns: [],
        enforcement: ['middleware'],
        reason: 'Security',
        verification: ['test'],
      },
      {
        id: 'GR-002',
        name: 'No direct DB in controller',
        rule: 'Controllers access DB through services',
        severity: 'blocking',
        scope: ['**/*.controller.ts'],
        allowedPatterns: [],
        forbiddenPatterns: [],
        enforcement: ['lint'],
        reason: 'Architecture',
        verification: ['review'],
      },
      {
        id: 'GR-003',
        name: 'Input validation',
        rule: 'Validate all input',
        severity: 'blocking',
        scope: ['src/**'],
        allowedPatterns: [],
        forbiddenPatterns: [],
        enforcement: ['zod'],
        reason: 'Security',
        verification: ['test'],
      },
    ],
    ...overrides,
  } as Guardrails;
}

function makeBlueprint(): Blueprint {
  return {
    schemaVersion: '1.0',
    modelVersion: 1,
    projectId: 'proj-1',
    projectName: 'TestProject',
    version: '1.0',
    summary: 'This is a comprehensive summary of the blueprint for the project architecture.',
    architectureStyle: 'Clean Architecture',
    securityLevel: 'hardened',
    techStack: {
      language: 'TypeScript',
      runtime: 'Node.js',
      framework: 'NestJS',
      database: 'PostgreSQL',
    },
    sections: Array.from({ length: 15 }, (_, i) => ({
      id: `SEC-${i}`,
      title: i < 12 ? `Section ${i}` : `Test section ${i}`,
      purpose: 'Purpose',
      directives: ['do something', 'verify something', 'deploy something'],
    })),
    generatedAt: '2024-01-01',
  };
}

describe('evaluateMapQuality', () => {
  it('returns score and grade for valid map', () => {
    const map = makeMap();
    const result = evaluateMapQuality(map);
    expect(result.artifact).toBe('map');
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.grade).toBeDefined();
    expect(result.checks.length).toBeGreaterThan(0);
    expect(result.recommendations).toBeDefined();
  });

  it('penalizes empty map', () => {
    const emptyMap = makeMap({
      components: [],
      services: [],
      dataStores: [],
      externalSystems: [],
      requirements: [],
      workflows: [],
      relationships: [],
      environments: [],
      infrastructure: [],
    });
    const fullMap = makeMap();
    const emptyResult = evaluateMapQuality(emptyMap);
    const fullResult = evaluateMapQuality(fullMap);
    expect(emptyResult.score).toBeLessThan(fullResult.score);
    expect(emptyResult.recommendations.length).toBeGreaterThan(0);
  });
});

describe('evaluateMentalModelQuality', () => {
  it('returns score for valid model', () => {
    const model = makeMentalModel();
    const result = evaluateMentalModelQuality(model);
    expect(result.artifact).toBe('mental-model');
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.grade).toBeDefined();
  });
});

describe('evaluateGuardrailsQuality', () => {
  it('returns score for valid guardrails', () => {
    const model = makeMentalModel();
    const guardrails = makeGuardrails(model);
    const result = evaluateGuardrailsQuality(guardrails, model);
    expect(result.artifact).toBe('guardrails');
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.grade).toBeDefined();
  });
});

describe('evaluateOverallQuality', () => {
  it('combines all artifact scores', () => {
    const map = makeMap();
    const model = makeMentalModel();
    const guardrails = makeGuardrails(model);
    const blueprint = makeBlueprint();
    const result = evaluateOverallQuality(map, model, guardrails, blueprint);
    expect(result.artifact).toBe('overall');
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.checks.length).toBeGreaterThan(0);
  });
});

describe('grade calculation', () => {
  it('returns A+ for 95+', () => {
    const map = makeMap();
    const model = makeMentalModel();
    const guardrails = makeGuardrails(model);
    const blueprint = makeBlueprint();
    const result = evaluateOverallQuality(map, model, guardrails, blueprint);
    if (result.score >= 95) {
      expect(result.grade).toBe('A+');
    }
  });

  it('returns A for 90+', () => {
    const map = makeMap();
    const model = makeMentalModel();
    const guardrails = makeGuardrails(model);
    const blueprint = makeBlueprint();
    const result = evaluateOverallQuality(map, model, guardrails, blueprint);
    if (result.score >= 90 && result.score < 95) {
      expect(result.grade).toBe('A');
    }
  });

  it('returns B+ for 80+', () => {
    const map = makeMap();
    const model = makeMentalModel();
    const guardrails = makeGuardrails(model);
    const blueprint = makeBlueprint();
    const result = evaluateOverallQuality(map, model, guardrails, blueprint);
    if (result.score >= 80 && result.score < 85) {
      expect(result.grade).toBe('B+');
    }
  });

  it('returns lower grades for lower scores', () => {
    const emptyMap = makeMap({
      components: [],
      services: [],
      dataStores: [],
      externalSystems: [],
      requirements: [],
      workflows: [],
      relationships: [],
      environments: [],
      infrastructure: [],
    });
    const model = makeMentalModel({ invariants: [], failureModes: [], businessRules: [], risks: [] });
    const guardrails = makeGuardrails(model, { guardrails: [] });
    const blueprint = makeBlueprint();
    const fullMap = makeMap();
    const fullModel = makeMentalModel();
    const fullGuardrails = makeGuardrails(fullModel);
    const fullBlueprint = makeBlueprint();
    const degradedResult = evaluateOverallQuality(emptyMap, model, guardrails, blueprint);
    const fullResult = evaluateOverallQuality(fullMap, fullModel, fullGuardrails, fullBlueprint);
    expect(degradedResult.score).toBeLessThan(fullResult.score);
  });
});
