export type KnowledgeType =
  | 'fact'
  | 'inference'
  | 'assumption'
  | 'recommendation'
  | 'proposal'
  | 'decision'
  | 'implementation'
  | 'verification'
  | 'unknown';

export type Severity = 'advisory' | 'warning' | 'blocking';

export type RequirementPriority = 'critical' | 'high' | 'medium' | 'low';
export type RequirementSource = 'developer' | 'inferred' | 'recommendation';
export type RequirementStatus = 'open' | 'implemented' | 'verified' | 'rejected';

export type VerificationVerdict = 'PASS' | 'REVIEW' | 'BLOCK';

export interface Confidence {
  confidence?: number;
  reason?: string;
}

export type EvidenceType =
  | 'source-file'
  | 'test'
  | 'git-commit'
  | 'developer-confirmation'
  | 'runtime-observation'
  | 'dependency'
  | 'documentation';

export interface Evidence {
  type: EvidenceType;
  location: string;
  description: string;
  confidence?: number;
}

export interface VersionedArtifact {
  schemaVersion: string;
  modelVersion: number;
  updatedAt?: string;
  basedOnCommit?: string | null;
}

export interface EngineeringOSConfig {
  schemaVersion: string;
  projectId: string;
  projectName: string;
  workspacePath: string;
  createdAt: string;
  updatedAt: string;
  analysis: {
    enabled: boolean;
    watchFiles: boolean;
    watchGit: boolean;
  };
  ai: {
    provider: string;
    contextMode: string;
    enabled?: boolean;
    model?: string;
    baseUrl?: string;
    apiKeyEnv?: string;
  };
}

export type ConfigLike = EngineeringOSConfig;

export interface Requirement extends VersionedArtifact {
  id: string;
  text: string;
  source: RequirementSource;
  priority: RequirementPriority;
  status: RequirementStatus;
  evidence: Evidence[];
  affectedComponents: string[];
}

export interface Component {
  id: string;
  name: string;
  purpose: string;
  responsibilities: string[];
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  dependents: string[];
  interfaces: string[];
  failureModes: string[];
  sourceLocations: string[];
}

export interface Service {
  id: string;
  name: string;
  purpose: string;
  responsibilities: string[];
  dependencies: string[];
  dependents: string[];
  interfaces: string[];
  failureModes: string[];
  sourceLocations: string[];
}

export interface DataStore {
  id: string;
  name: string;
  purpose: string;
  tables: string[];
  dependencies: string[];
  dependents: string[];
  interfaces: string[];
  failureModes: string[];
  sourceLocations: string[];
}

export interface ExternalSystem {
  id: string;
  name: string;
  purpose: string;
  interactions: string[];
  dependencies: string[];
  dependents: string[];
  interfaces: string[];
  failureModes: string[];
  sourceLocations: string[];
}

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: string;
  description?: string;
}

export interface DataFlowStep {
  step: string;
  from?: string;
  to?: string;
  data?: string;
}

export interface DataFlow {
  id: string;
  name: string;
  description: string;
  steps: string[] | DataFlowStep[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: string[];
  components: string[];
  inputs: string[];
  outputs: string[];
}

export interface Dependency {
  id: string;
  name: string;
  type: 'runtime' | 'dev' | 'peer' | 'infrastructure';
  version?: string;
  purpose?: string;
  critical?: boolean;
}

export interface Environment {
  id: string;
  name: string;
  description: string;
  properties: string[];
}

export interface Infrastructure {
  id: string;
  name: string;
  description: string;
  details: string[];
}

export interface ProjectInfo {
  id?: string;
  name: string;
  purpose?: string;
  description?: string;
}

export interface Map extends VersionedArtifact {
  project: ProjectInfo;
  actors: {
    id: string;
    name: string;
    description: string;
    interactions: string[];
  }[];
  requirements: Requirement[];
  components: Component[];
  services: Service[];
  dataStores: DataStore[];
  externalSystems: ExternalSystem[];
  relationships: Relationship[];
  dataFlows: DataFlow[];
  workflows: Workflow[];
  dependencies: Dependency[];
  environments: Environment[];
  infrastructure: Infrastructure[];
}

export interface SystemUnderstanding {
  purpose?: string;
  primaryUsers: string[];
  businessObjective?: string;
  criticalCapabilities: string[];
  primaryWorkflows?: string[];
  mostImportantConstraints?: string[];
}

export interface ModelEntity {
  id: string;
  name: string;
  description: string;
  kind: string;
  source?: KnowledgeType | EvidenceType | string;
  confidence?: number;
}

export interface MentalRelationship {
  id: string;
  from: string;
  to: string;
  type: string;
  description: string;
}

export interface CausalRelationship {
  id: string;
  cause: string;
  effect: string;
  conditions: string[];
  sideEffects: string[];
}

export interface BusinessRule {
  id: string;
  statement: string;
  severity: Severity;
  source: KnowledgeType;
  confidence?: number;
}

export interface Invariant {
  id: string;
  statement: string;
  severity: Severity;
  scope: string[];
  enforcement: string[];
  verification: string[];
}

export interface StateTransition {
  from: string;
  to: string;
  trigger: string;
}

export interface StateMachine {
  entity: string;
  states: string[];
  transitions: StateTransition[];
  invalidTransitions: string[];
}

export interface FailureMode {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  mitigation: string;
  evidence: Evidence[];
}

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  appliesTo: string;
}

export interface ArchitecturalPrinciple {
  id: string;
  name: string;
  description: string;
}

export interface Decision {
  id: string;
  title: string;
  context: string;
  decision: string;
  reason: string;
  alternatives: string[];
  consequences: string[];
  affectedComponents: string[];
  status: string;
  date: string;
  source: KnowledgeType | EvidenceType | string;
  confidence?: number;
  confidenceReason?: string;
}

export interface Assumption extends Confidence {
  id: string;
  statement: string;
  impact: string;
  source: KnowledgeType;
  evidence: Evidence[];
}

export interface Unknown extends Confidence {
  id: string;
  question: string;
  impact: string;
  blocks: string[];
  status: string;
  evidence: Evidence[];
}

export interface Constraint {
  id: string;
  statement: string;
  scope: string;
}

export interface Risk {
  id: string;
  name: string;
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface Prediction {
  id: string;
  statement: string;
  confidence: number;
  evidence: Evidence[];
}

export interface StateDescription {
  summary: string;
  modelStage?: string;
  confidence?: number;
}

export interface MentalModel extends VersionedArtifact, Confidence {
  systemUnderstanding: SystemUnderstanding;
  entities: ModelEntity[];
  relationships: MentalRelationship[];
  causalRelationships: CausalRelationship[];
  businessRules: BusinessRule[];
  invariants: Invariant[];
  stateMachines: StateMachine[];
  workflows: Workflow[];
  failureModes: FailureMode[];
  recoveryStrategies: RecoveryStrategy[];
  architecturalPrinciples: ArchitecturalPrinciple[];
  decisions: Decision[];
  assumptions: Assumption[];
  unknowns: Unknown[];
  constraints: Constraint[];
  currentState: StateDescription;
  intendedState: StateDescription;
  risks: Risk[];
  predictions: Prediction[];
  evidence: Evidence[];
}

export interface Guardrail {
  id: string;
  name: string;
  rule: string;
  severity: Severity;
  scope: string[];
  allowedPatterns: string[];
  forbiddenPatterns: string[];
  enforcement: string[];
  reason: string;
  verification: string[];
}

export interface Guardrails extends VersionedArtifact {
  guardrails: Guardrail[];
}

export interface BlueprintSection {
  id: string;
  title: string;
  purpose: string;
  directives: string[];
}

export interface BlueprintTechStack {
  language: string;
  runtime: string;
  framework: string;
  database: string;
}

export interface Blueprint extends VersionedArtifact {
  projectId: string;
  projectName: string;
  version: string;
  summary: string;
  architectureStyle: string;
  securityLevel: 'baseline' | 'hardened' | 'regulated';
  techStack: BlueprintTechStack;
  sections: BlueprintSection[];
  sourceSpec?: string;
  generatedAt: string;
}

export interface BlueprintOptions {
  architectureStyle?: string;
  securityLevel?: 'baseline' | 'hardened' | 'regulated';
  language?: string;
  runtime?: string;
  framework?: string;
  database?: string;
  sourceSpec?: string;
}

export interface EchoSignal {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  message: string;
  file: string;
  line?: number;
  expectedBoundary?: string[];
  suggestedCorrection?: string;
}

export type ValidatorKind =
  | 'file-boundary'
  | 'import'
  | 'dependency'
  | 'pattern'
  | 'typescript'
  | 'test'
  | 'custom';

export interface GuardrailCheckInput {
  rule: Guardrail;
  files: ScannedFile[];
  imports: ImportRecord[];
  dependencies: string[];
  validatorKinds: ValidatorKind[];
}

export interface GuardrailResult {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  status: 'pass' | 'warn' | 'fail';
  signals: EchoSignal[];
}

export interface ScannedFile {
  path: string;
  content: string;
  relativePath: string;
}

export interface ImportRecord {
  file: string;
  importPath: string;
}

export interface ContextPackage {
  task: string;
  relevantRequirements: string[];
  relevantComponents: string[];
  relevantRelationships: string[];
  relevantInvariants: string[];
  relevantGuardrails: string[];
  relevantDecisions: string[];
  relevantRisks: string[];
  unknowns: string[];
  verificationPlan: string[];
  estimatedTokens: number;
  createdAt: string;
}

export interface ImpactItem {
  id: string;
  name: string;
  kind: 'component' | 'service' | 'workflow' | 'dataflow' | 'external-system';
}

export interface ImpactReport {
  target: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  affectedComponents: ImpactItem[];
  affectedWorkflows: string[];
  relevantInvariants: string[];
  relevantGuardrails: string[];
  requiredVerification: string[];
  evidence: Evidence[];
}

export interface DriftFinding {
  id: string;
  driftType:
    | 'model-to-code'
    | 'code-to-model'
    | 'requirement-to-implementation'
    | 'guardrail-to-code';
  severity: Severity;
  title: string;
  description: string;
  evidence: string[];
  proposedChange?: string;
  confidence: number;
}

export interface UpdateProposal {
  added: string[];
  changed: string[];
  removed: string[];
  confidence: number;
  basedOn: string[];
}

export interface DriftReport {
  findings: DriftFinding[];
  updateProposal: UpdateProposal;
}

export interface VerificationResult {
  check: string;
  verdict: VerificationVerdict;
  evidence: string[];
  notVerified: string[];
}

export interface VerificationReport {
  overall: VerificationVerdict;
  results: VerificationResult[];
  completedAt: string;
}
