import { describe, it, expect } from 'vitest';
import {
  AIDomainModelSchema,
  AIMentalModelSchema,
  AIGuardrailsOutputSchema,
  AIThreatModelSchema,
} from './schemas';

describe('AIDomainModelSchema', () => {
  it('validates correct shape', () => {
    const input = {
      entities: [
        {
          name: 'User',
          description: 'A system user',
          properties: [{ name: 'id', type: 'string', required: true }],
          relationships: [{ target: 'Order', type: 'has-many', description: 'places orders' }],
        },
      ],
      valueObjects: [{ name: 'Money', properties: [{ name: 'amount', type: 'number' }] }],
      boundedContexts: [{ name: 'Catalog', description: 'Product catalog', entities: ['Product'] }],
      domainEvents: [
        {
          name: 'OrderPlaced',
          description: 'Order was placed',
          trigger: 'checkout',
          steps: ['validate', 'save'],
          actors: ['Customer'],
          payload: { orderId: 'string' },
        },
      ],
      relationships: [
        { from: 'User', to: 'Order', type: 'has-many', description: 'places' },
      ],
    };
    const result = AIDomainModelSchema.parse(input);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe('User');
    expect(result.valueObjects).toHaveLength(1);
    expect(result.boundedContexts).toHaveLength(1);
    expect(result.domainEvents).toHaveLength(1);
    expect(result.relationships).toHaveLength(1);
  });

  it('rejects invalid shapes', () => {
    expect(() => AIDomainModelSchema.parse({ entities: 'not an array' })).toThrow();
  });
});

describe('AIMentalModelSchema', () => {
  it('validates correct shape', () => {
    const input = {
      invariants: [
        {
          id: 'INV-1',
          statement: 'Order total must be positive',
          severity: 'blocking',
          scope: ['OrderService'],
          enforcement: ['validation'],
          verification: ['unit test'],
        },
      ],
      stateMachines: [
        {
          entity: 'Order',
          states: ['pending', 'confirmed'],
          transitions: [{ from: 'pending', to: 'confirmed', trigger: 'confirm' }],
          invalidTransitions: [],
        },
      ],
      failureModes: [
        {
          id: 'FM-1',
          name: 'DB timeout',
          description: 'Database connection times out',
          severity: 'blocking',
          mitigation: 'retry with backoff',
          evidence: [],
        },
      ],
      recoveryStrategies: [
        { id: 'REC-1', name: 'Retry', description: 'Retry the operation', appliesTo: 'FM-1' },
      ],
      decisions: [
        {
          id: 'DEC-1',
          title: 'Use PostgreSQL',
          context: 'Need relational DB',
          decision: 'PostgreSQL',
          reason: 'ACID compliance',
          alternatives: [],
          consequences: [],
          affectedComponents: [],
          status: 'accepted',
          date: '2024-01-01',
          source: 'recommendation',
        },
      ],
      risks: [
        {
          id: 'RISK-1',
          name: 'High load',
          description: 'Unexpected traffic spike',
          likelihood: 'medium',
          impact: 'high',
          mitigation: 'auto-scaling',
        },
      ],
      businessRules: [
        { id: 'BR-1', statement: 'Minimum order $10', severity: 'warning', source: 'recommendation' },
      ],
      constraints: [
        { id: 'CON-1', statement: 'Must run on AWS', scope: 'global' },
      ],
    };
    const result = AIMentalModelSchema.parse(input);
    expect(result.invariants).toHaveLength(1);
    expect(result.stateMachines).toHaveLength(1);
    expect(result.failureModes).toHaveLength(1);
    expect(result.recoveryStrategies).toHaveLength(1);
    expect(result.decisions).toHaveLength(1);
    expect(result.risks).toHaveLength(1);
    expect(result.businessRules).toHaveLength(1);
    expect(result.constraints).toHaveLength(1);
  });

  it('rejects invalid shapes', () => {
    expect(() => AIMentalModelSchema.parse({ invariants: 'bad' })).toThrow();
  });
});

describe('AIGuardrailsOutputSchema', () => {
  it('validates correct shape', () => {
    const input = {
      guardrails: [
        {
          name: 'No direct DB in controller',
          rule: 'Controllers must not access DB directly',
          severity: 'blocking',
          scope: ['**/*.controller.ts'],
          allowedPatterns: [],
          forbiddenPatterns: ['Repository'],
          enforcement: ['AST scan'],
          reason: 'Separation of concerns',
          verification: ['grep check'],
        },
      ],
    };
    const result = AIGuardrailsOutputSchema.parse(input);
    expect(result.guardrails).toHaveLength(1);
    expect(result.guardrails[0].name).toBe('No direct DB in controller');
    expect(result.guardrails[0].severity).toBe('blocking');
  });

  it('rejects invalid shapes', () => {
    expect(() => AIGuardrailsOutputSchema.parse({ guardrails: 'bad' })).toThrow();
  });
});

describe('AIThreatModelSchema', () => {
  it('validates correct shape', () => {
    const input = {
      threats: [
        {
          stride: 'Spoofing',
          threat: 'Attacker impersonates a user',
          affectedComponent: 'AuthService',
          severity: 'high',
          mitigation: 'Enforce MFA',
        },
      ],
      attackSurface: ['Public API', 'Login endpoint'],
      securityRequirements: [
        { text: 'All endpoints require auth', severity: 'blocking' },
        'Use HTTPS everywhere',
      ],
    };
    const result = AIThreatModelSchema.parse(input);
    expect(result.threats).toHaveLength(1);
    expect(result.threats[0].stride).toBe('Spoofing');
    expect(result.attackSurface).toHaveLength(2);
    expect(result.securityRequirements).toHaveLength(2);
  });

  it('rejects invalid shapes', () => {
    expect(() => AIThreatModelSchema.parse({ threats: 'bad' })).toThrow();
  });
});
