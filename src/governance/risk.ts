export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ChangeRequest {
  id: string;
  description: string;
  requestedBy: string;
  requestedAt: string;
  files: string[];
  riskTier?: RiskTier;
  plan?: ChangePlan;
  approval?: Approval;
  status: 'draft' | 'planned' | 'pending-approval' | 'approved' | 'rejected' | 'implemented' | 'verified';
}

export interface ChangePlan {
  problem: string;
  userOrSystemOutcome: string;
  riskTier: RiskTier;
  affectedComponents: string[];
  affectedInvariants: string[];
  relevantDecisions: string[];
  relevantGuardrails: string[];
  minimalSafeChange: string;
  filesAllowed: string[];
  filesForbidden: string[];
  failureModes: string[];
  rollbackPlan: string;
  testsRequired: string[];
  validationCommands: string[];
  approvalRequired: boolean;
  createdAt: string;
}

export interface Approval {
  required: boolean;
  approvers: ApproverDecision[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt?: string;
}

export interface ApproverDecision {
  approver: string;
  decision: 'approved' | 'rejected' | 'abstained';
  comment?: string;
  decidedAt: string;
}

export interface RiskPolicy {
  autoApproveBelow: RiskTier;
  requirePlanAbove: RiskTier;
  requireAdrAbove: RiskTier;
  requireApprovalAbove: RiskTier;
  maxFilesPerChange: Record<RiskTier, number>;
  forbiddenPaths: string[];
  requiredValidationCommands: string[];
}

export const DEFAULT_RISK_POLICY: RiskPolicy = {
  autoApproveBelow: 'LOW',
  requirePlanAbove: 'LOW',
  requireAdrAbove: 'HIGH',
  requireApprovalAbove: 'HIGH',
  maxFilesPerChange: { LOW: 20, MEDIUM: 10, HIGH: 5, CRITICAL: 3 },
  forbiddenPaths: ['.github/workflows/', 'docker-compose', 'migrations/'],
  requiredValidationCommands: ['npm run typecheck', 'npm test']
};

const HIGH_RISK_PATTERNS = [
  { pattern: /auth|login|session|token|jwt|oauth/i, reason: 'Authentication/authorization' },
  { pattern: /payment|checkout|billing|invoice|stripe|paypal/i, reason: 'Payment processing' },
  { pattern: /migrat|schema.*change|database.*alter/i, reason: 'Database migration' },
  { pattern: /encrypt|decrypt|hash|bcrypt|argon/i, reason: 'Cryptography' },
  { pattern: /permission|role|acl|rbac|access.*control/i, reason: 'Access control' },
  { pattern: /deploy|release|publish|ship/i, reason: 'Deployment/release' },
];

const CRITICAL_PATTERNS = [
  { pattern: /DELETE.*FROM|DROP\s+TABLE|TRUNCATE/i, reason: 'Destructive data operation' },
  { pattern: /financial|clinical|health.*data|pii|phi/i, reason: 'Regulated data' },
  { pattern: /security.*boundary|trust.*boundary|external.*integration/i, reason: 'Security boundary' },
  { pattern: /migrations?\//i, reason: 'Database migration' },
];

export function classifyRisk(
  change: ChangeRequest,
  policy: RiskPolicy = DEFAULT_RISK_POLICY
): RiskTier {
  if (change.files.some(f => CRITICAL_PATTERNS.some(p => p.pattern.test(f)))) return 'CRITICAL';
  if (change.files.some(f => HIGH_RISK_PATTERNS.some(p => p.pattern.test(f)))) return 'HIGH';

  const text = change.description.toLowerCase();
  if (CRITICAL_PATTERNS.some(p => p.pattern.test(text))) return 'CRITICAL';
  if (HIGH_RISK_PATTERNS.some(p => p.pattern.test(text))) return 'HIGH';

  if (change.files.length > policy.maxFilesPerChange.MEDIUM) return 'MEDIUM';
  if (change.files.some(f => policy.forbiddenPaths.some(p => f.includes(p)))) return 'HIGH';

  return 'LOW';
}

export function generateChangePlan(
  change: ChangeRequest,
  context: {
    components: { id: string; name: string; purpose: string }[];
    invariants: { id: string; statement: string; severity: string }[];
    guardrails: { id: string; rule: string; severity: string }[];
    decisions: { id: string; decision: string }[];
  }
): ChangePlan {
  const riskTier = classifyRisk(change);
  const affectedComponents = context.components
    .filter(c => change.files.some(f => f.includes(c.id) || c.name.toLowerCase().includes(f.split('/').pop()?.split('.')[0]?.toLowerCase() ?? '')))
    .map(c => c.id);

  const affectedInvariants = context.invariants
    .filter(i => affectedComponents.some(c => i.statement.toLowerCase().includes(c)))
    .map(i => i.id);

  const relevantGuardrails = context.guardrails
    .filter(g => affectedComponents.some(c => g.rule.toLowerCase().includes(c)))
    .map(g => g.id);

  return {
    problem: change.description,
    userOrSystemOutcome: `Implement: ${change.description}`,
    riskTier,
    affectedComponents,
    affectedInvariants,
    relevantDecisions: context.decisions.map(d => d.id),
    relevantGuardrails,
    minimalSafeChange: `Change ${change.files.length} file(s) with appropriate tests and validation.`,
    filesAllowed: change.files,
    filesForbidden: [],
    failureModes: [
      'Regression in affected components',
      'Breaking change to public interfaces',
      'Missing edge case handling'
    ],
    rollbackPlan: 'Revert commit(s) and run full test suite.',
    testsRequired: affectedComponents.map(c => `tests/${c}/**/*.spec.ts`),
    validationCommands: ['npm run typecheck', 'npm test'],
    approvalRequired: riskTier === 'HIGH' || riskTier === 'CRITICAL',
    createdAt: new Date().toISOString()
  };
}

export function needsApproval(change: ChangeRequest, policy: RiskPolicy = DEFAULT_RISK_POLICY): boolean {
  if (!change.riskTier) return false;
  const tierOrder: RiskTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const changeIdx = tierOrder.indexOf(change.riskTier);
  const policyIdx = tierOrder.indexOf(policy.requireApprovalAbove);
  return changeIdx >= policyIdx;
}

export function needsPlan(change: ChangeRequest, policy: RiskPolicy = DEFAULT_RISK_POLICY): boolean {
  if (!change.riskTier) return true;
  const tierOrder: RiskTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const changeIdx = tierOrder.indexOf(change.riskTier);
  const policyIdx = tierOrder.indexOf(policy.requirePlanAbove);
  return changeIdx >= policyIdx;
}
