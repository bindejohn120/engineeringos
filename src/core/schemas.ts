import { z } from 'zod';
import {
  type Blueprint,
  type ConfigLike,
  type Guardrails,
  type Map,
  type MentalModel,
  type Requirement
} from './types';

export const versionedBase = {
  schemaVersion: z.string(),
  modelVersion: z.number().int().nonnegative(),
  updatedAt: z.string().optional(),
  basedOnCommit: z.string().nullable().optional()
};

const evidenceSchema = z.object({
  type: z.enum([
    'source-file',
    'test',
    'git-commit',
    'developer-confirmation',
    'runtime-observation',
    'dependency',
    'documentation'
  ]),
  location: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1).optional()
});

export const requirementSchema = z.object({
  ...versionedBase,
  id: z.string().min(1),
  text: z.string().min(1),
  source: z.enum(['developer', 'inferred', 'recommendation']),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  status: z.enum(['open', 'implemented', 'verified', 'rejected']),
  evidence: z.array(evidenceSchema).default([]),
  affectedComponents: z.array(z.string()).default([])
});

const componentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().default(''),
  responsibilities: z.array(z.string()).default([]),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  dependents: z.array(z.string()).default([]),
  interfaces: z.array(z.string()).default([]),
  failureModes: z.array(z.string()).default([]),
  sourceLocations: z.array(z.string()).default([])
});

const serviceSchema = componentSchema;
const dataStoreSchema = componentSchema.extend({
  tables: z.array(z.string()).default([])
});
const externalSystemSchema = componentSchema.extend({
  interactions: z.array(z.string()).default([])
});

const relationshipSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional()
});

const dataFlowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  steps: z.array(z.union([z.string(), z.object({
    step: z.string(),
    from: z.string().optional(),
    to: z.string().optional(),
    data: z.string().optional()
  })])).default([])
});

const workflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  steps: z.array(z.string()).default([]),
  components: z.array(z.string()).default([]),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([])
});

const dependencySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['runtime', 'dev', 'peer', 'infrastructure']),
  version: z.string().optional(),
  purpose: z.string().optional(),
  critical: z.boolean().optional()
});

const environmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  properties: z.array(z.string()).default([])
});

const infrastructureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  details: z.array(z.string()).default([])
});

const actorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  interactions: z.array(z.string()).default([])
});

const projectInfoSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  purpose: z.string().optional(),
  description: z.string().optional()
});

export const mapSchema = z.object({
  ...versionedBase,
  project: projectInfoSchema.default({ name: '' }),
  actors: z.array(actorSchema).default([]),
  requirements: z.array(requirementSchema).default([]),
  components: z.array(componentSchema).default([]),
  services: z.array(serviceSchema).default([]),
  dataStores: z.array(dataStoreSchema).default([]),
  externalSystems: z.array(externalSystemSchema).default([]),
  relationships: z.array(relationshipSchema).default([]),
  dataFlows: z.array(dataFlowSchema).default([]),
  workflows: z.array(workflowSchema).default([]),
  dependencies: z.array(dependencySchema).default([]),
  environments: z.array(environmentSchema).default([]),
  infrastructure: z.array(infrastructureSchema).default([])
});

const systemUnderstandingSchema = z.object({
  purpose: z.string().optional(),
  primaryUsers: z.array(z.string()).default([]),
  businessObjective: z.string().optional(),
  criticalCapabilities: z.array(z.string()).default([]),
  primaryWorkflows: z.array(z.string()).optional(),
  mostImportantConstraints: z.array(z.string()).optional()
});

const entitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  kind: z.string().default('concept'),
  source: z.string().optional(),
  confidence: z.number().min(0).max(1).optional()
});

const mentalRelationshipSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.string().min(1),
  description: z.string().default('')
});

const causalSchema = z.object({
  id: z.string().min(1),
  cause: z.string().min(1),
  effect: z.string().min(1),
  conditions: z.array(z.string()).default([]),
  sideEffects: z.array(z.string()).default([])
});

const businessRuleSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  severity: z.enum(['advisory', 'warning', 'blocking']),
  source: z.string().default('inference'),
  confidence: z.number().min(0).max(1).optional()
});

const invariantSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  severity: z.enum(['advisory', 'warning', 'blocking']),
  scope: z.array(z.string()).default([]),
  enforcement: z.array(z.string()).default([]),
  verification: z.array(z.string()).default([])
});

const stateTransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  trigger: z.string()
});

const stateMachineSchema = z.object({
  entity: z.string().min(1),
  states: z.array(z.string()).default([]),
  transitions: z.array(stateTransitionSchema).default([]),
  invalidTransitions: z.array(z.string()).default([])
});

const failureModeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  severity: z.enum(['advisory', 'warning', 'blocking']).default('warning'),
  mitigation: z.string().default(''),
  evidence: z.array(evidenceSchema).default([])
});

const recoveryStrategySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  appliesTo: z.string().default('')
});

const principleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default('')
});

const decisionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  context: z.string().default(''),
  decision: z.string().min(1),
  reason: z.string().default(''),
  alternatives: z.array(z.string()).default([]),
  consequences: z.array(z.string()).default([]),
  affectedComponents: z.array(z.string()).default([]),
  status: z.string().default('accepted'),
  date: z.string().default(''),
  source: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  confidenceReason: z.string().optional()
});

const assumptionSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  impact: z.string().default('medium'),
  source: z.string().default('inference'),
  evidence: z.array(evidenceSchema).default([]),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().optional()
});

const unknownSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  impact: z.string().default('medium'),
  blocks: z.array(z.string()).default([]),
  status: z.string().default('unresolved'),
  evidence: z.array(evidenceSchema).default([]),
  confidence: z.number().min(0).max(1).optional()
});

const constraintSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  scope: z.string().default('')
});

const riskSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  likelihood: z.enum(['low', 'medium', 'high']),
  impact: z.enum(['low', 'medium', 'high']),
  mitigation: z.string().default('')
});

const predictionSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(evidenceSchema).default([])
});

const stateDescriptionSchema = z.object({
  summary: z.string().default(''),
  modelStage: z.string().optional(),
  confidence: z.number().min(0).max(1).optional()
});

export const mentalModelSchema = z.object({
  ...versionedBase,
  systemUnderstanding: systemUnderstandingSchema.default({
    primaryUsers: [],
    criticalCapabilities: []
  }),
  entities: z.array(entitySchema).default([]),
  relationships: z.array(mentalRelationshipSchema).default([]),
  causalRelationships: z.array(causalSchema).default([]),
  businessRules: z.array(businessRuleSchema).default([]),
  invariants: z.array(invariantSchema).default([]),
  stateMachines: z.array(stateMachineSchema).default([]),
  workflows: z.array(workflowSchema).default([]),
  failureModes: z.array(failureModeSchema).default([]),
  recoveryStrategies: z.array(recoveryStrategySchema).default([]),
  architecturalPrinciples: z.array(principleSchema).default([]),
  decisions: z.array(decisionSchema).default([]),
  assumptions: z.array(assumptionSchema).default([]),
  unknowns: z.array(unknownSchema).default([]),
  constraints: z.array(constraintSchema).default([]),
  currentState: stateDescriptionSchema.default({ summary: '' }),
  intendedState: stateDescriptionSchema.default({ summary: '' }),
  risks: z.array(riskSchema).default([]),
  predictions: z.array(predictionSchema).default([]),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
  evidence: z.array(evidenceSchema).default([])
});

export const guardrailSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rule: z.string().min(1),
  severity: z.enum(['advisory', 'warning', 'blocking']),
  scope: z.array(z.string()).default([]),
  allowedPatterns: z.array(z.string()).default([]),
  forbiddenPatterns: z.array(z.string()).default([]),
  enforcement: z.array(z.string()).default([]),
  reason: z.string().default(''),
  verification: z.array(z.string()).default([])
});

export const guardrailsSchema = z.object({
  ...versionedBase,
  guardrails: z.array(guardrailSchema).default([])
});

const blueprintSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  purpose: z.string().default(''),
  directives: z.array(z.string()).default([])
});

export const blueprintSchema = z.object({
  ...versionedBase,
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  version: z.string().default('1.0'),
  summary: z.string().default(''),
  architectureStyle: z.string().default('layered'),
  securityLevel: z.enum(['baseline', 'hardened', 'regulated']).default('baseline'),
  techStack: z.object({
    language: z.string().default(''),
    runtime: z.string().default(''),
    framework: z.string().default(''),
    database: z.string().default('')
  }).default({}),
  sections: z.array(blueprintSectionSchema).default([]),
  sourceSpec: z.string().optional(),
  generatedAt: z.string().default('')
});

export const configSchema = z.object({
  schemaVersion: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  workspacePath: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  analysis: z.object({
    enabled: z.boolean(),
    watchFiles: z.boolean(),
    watchGit: z.boolean()
  }),
  ai: z.object({
    provider: z.string(),
    contextMode: z.string(),
    enabled: z.boolean().optional(),
    model: z.string().optional(),
    baseUrl: z.string().optional(),
    apiKeyEnv: z.string().optional()
  })
});

export type MapInput = z.infer<typeof mapSchema>;
export type MentalModelInput = z.infer<typeof mentalModelSchema>;
export type GuardrailsInput = z.infer<typeof guardrailsSchema>;
export type BlueprintInput = z.infer<typeof blueprintSchema>;
export type ConfigInput = z.infer<typeof configSchema>;

export function validateMap(data: unknown): Map {
  return mapSchema.parse(data) as unknown as Map;
}

export function validateMentalModel(data: unknown): MentalModel {
  return mentalModelSchema.parse(data) as unknown as MentalModel;
}

export function validateGuardrails(data: unknown): Guardrails {
  return guardrailsSchema.parse(data) as unknown as Guardrails;
}

export function validateBlueprint(data: unknown): Blueprint {
  return blueprintSchema.parse(data) as unknown as Blueprint;
}

export function validateConfig(data: unknown): ConfigLike {
  return configSchema.parse(data) as unknown as ConfigLike;
}

export function validateRequirement(data: unknown): Requirement {
  return requirementSchema.parse(data) as unknown as Requirement;
}

export function safeParse<T>(schema: z.ZodType<T>, data: unknown): {
  ok: true;
  data: T;
} | {
  ok: false;
  errors: z.ZodError;
} {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { ok: false, errors: result.error };
}

export function safeParseMap(data: unknown) {
  return safeParse(mapSchema, data);
}

export function safeParseMentalModel(data: unknown) {
  return safeParse(mentalModelSchema, data);
}

export function safeParseGuardrails(data: unknown) {
  return safeParse(guardrailsSchema, data);
}

export function safeParseBlueprint(data: unknown) {
  return safeParse(blueprintSchema, data);
}

export function safeParseConfig(data: unknown) {
  return safeParse(configSchema, data);
}
