import { z } from 'zod';

const EvidenceSchema = z.object({
  type: z.string().default('documentation'),
  location: z.string().default(''),
  description: z.string().default('')
}).passthrough();

export const InvariantSchema = z.object({
  id: z.string().default(''),
  statement: z.string().default(''),
  severity: z.enum(['advisory', 'warning', 'blocking']).default('warning'),
  scope: z.array(z.string()).default([]),
  enforcement: z.array(z.string()).default([]),
  verification: z.array(z.string()).default([])
});

export const StateTransitionSchema = z.object({
  from: z.string().default(''),
  to: z.string().default(''),
  trigger: z.string().default('')
});

export const StateMachineSchema = z.object({
  entity: z.string().default(''),
  states: z.array(z.string()).default([]),
  transitions: z.array(StateTransitionSchema).default([]),
  invalidTransitions: z.array(z.string()).default([])
});

export const FailureModeSchema = z.object({
  id: z.string().default(''),
  name: z.string().default(''),
  description: z.string().default(''),
  severity: z.enum(['advisory', 'warning', 'blocking']).default('warning'),
  mitigation: z.string().default(''),
  evidence: z.array(EvidenceSchema).default([])
});

export const RecoveryStrategySchema = z.object({
  id: z.string().default(''),
  name: z.string().default(''),
  description: z.string().default(''),
  appliesTo: z.string().default('')
});

export const DecisionSchema = z.object({
  id: z.string().default(''),
  title: z.string().default(''),
  context: z.string().default(''),
  decision: z.string().default(''),
  reason: z.string().default(''),
  alternatives: z.array(z.string()).default([]),
  consequences: z.array(z.string()).default([]),
  affectedComponents: z.array(z.string()).default([]),
  status: z.string().default('proposed'),
  date: z.string().default(''),
  source: z.string().default('recommendation'),
  confidence: z.number().optional(),
  confidenceReason: z.string().optional()
});

export const RiskSchema = z.object({
  id: z.string().default(''),
  name: z.string().default(''),
  description: z.string().default(''),
  likelihood: z.enum(['low', 'medium', 'high']).default('medium'),
  impact: z.enum(['low', 'medium', 'high']).default('medium'),
  mitigation: z.string().default('')
});

export const BusinessRuleSchema = z.object({
  id: z.string().default(''),
  statement: z.string().default(''),
  severity: z.enum(['advisory', 'warning', 'blocking']).default('warning'),
  source: z.string().default('recommendation'),
  confidence: z.number().optional()
});

export const ConstraintSchema = z.object({
  id: z.string().default(''),
  statement: z.string().default(''),
  scope: z.string().default('global')
});

export const AIMentalModelSchema = z.object({
  invariants: z.array(InvariantSchema).default([]),
  stateMachines: z.array(StateMachineSchema).default([]),
  failureModes: z.array(FailureModeSchema).default([]),
  recoveryStrategies: z.array(RecoveryStrategySchema).default([]),
  decisions: z.array(DecisionSchema).default([]),
  risks: z.array(RiskSchema).default([]),
  businessRules: z.array(BusinessRuleSchema).default([]),
  constraints: z.array(ConstraintSchema).default([])
});

export type AIMentalModelOutput = z.infer<typeof AIMentalModelSchema>;

const DomainEntitySchema = z.object({
  name: z.string().default(''),
  description: z.string().default(''),
  properties: z.array(z.object({
    name: z.string().default(''),
    type: z.string().default('string'),
    required: z.boolean().default(true)
  })).default([]),
  relationships: z.array(z.object({
    target: z.string().default(''),
    type: z.string().default('related-to'),
    description: z.string().default('')
  })).default([])
});

const DomainRelationshipSchema = z.object({
  from: z.string().default(''),
  to: z.string().default(''),
  type: z.string().default('related-to'),
  description: z.string().default('')
});

const DomainEventSchema = z.object({
  name: z.string().default(''),
  description: z.string().default(''),
  trigger: z.string().default(''),
  steps: z.array(z.string()).default([]),
  actors: z.array(z.string()).default([]),
  payload: z.record(z.string()).default({})
});

const ValueObjectSchema = z.object({
  name: z.string().default(''),
  properties: z.array(z.object({
    name: z.string().default(''),
    type: z.string().default('string')
  })).default([])
});

const BoundedContextSchema = z.object({
  name: z.string().default(''),
  description: z.string().default(''),
  entities: z.array(z.string()).default([])
});

export const AIDomainModelSchema = z.object({
  entities: z.array(DomainEntitySchema).default([]),
  valueObjects: z.array(ValueObjectSchema).default([]),
  boundedContexts: z.array(BoundedContextSchema).default([]),
  domainEvents: z.array(DomainEventSchema).default([]),
  relationships: z.array(DomainRelationshipSchema).default([])
});

export type AIDomainModelOutput = z.infer<typeof AIDomainModelSchema>;

const GuardrailSchema = z.object({
  name: z.string().default(''),
  rule: z.string().default(''),
  severity: z.enum(['advisory', 'warning', 'blocking']).default('warning'),
  scope: z.array(z.string()).default([]),
  allowedPatterns: z.array(z.string()).default([]),
  forbiddenPatterns: z.array(z.string()).default([]),
  enforcement: z.array(z.string()).default([]),
  reason: z.string().default(''),
  verification: z.array(z.string()).default([])
});

export const AIGuardrailsOutputSchema = z.object({
  guardrails: z.array(GuardrailSchema).default([])
});

export type AIGuardrailsOutput = z.infer<typeof AIGuardrailsOutputSchema>;

const ThreatSchema = z.object({
  stride: z.string().default(''),
  threat: z.string().default(''),
  affectedComponent: z.string().default(''),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  mitigation: z.string().default('')
});

const SecurityRequirementSchema = z.union([
  z.object({
    text: z.string().default(''),
    severity: z.enum(['advisory', 'warning', 'blocking']).default('warning')
  }),
  z.string()
]);

export const AIThreatModelSchema = z.object({
  threats: z.array(ThreatSchema).default([]),
  attackSurface: z.array(z.string()).default([]),
  securityRequirements: z.array(SecurityRequirementSchema).default([])
});

export type AIThreatModelOutput = z.infer<typeof AIThreatModelSchema>;
