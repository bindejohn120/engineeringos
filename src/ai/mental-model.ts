import type { AIClient } from './provider';
import type { Invariant, StateMachine, FailureMode, RecoveryStrategy, Decision, Risk, BusinessRule, Constraint } from '../core/types';
import { buildMentalModelPrompt } from './prompts';
import { AIMentalModelSchema } from './schemas';
import type { AIMentalModelOutput } from './schemas';
import { parseJsonObject } from './utils';

export interface AIMentalModelResult {
  ai: boolean;
  invariants: Invariant[];
  stateMachines: StateMachine[];
  failureModes: FailureMode[];
  recoveryStrategies: RecoveryStrategy[];
  decisions: Decision[];
  risks: Risk[];
  businessRules: BusinessRule[];
  constraints: Constraint[];
}

const emptyResult: AIMentalModelResult = {
  ai: false,
  invariants: [],
  stateMachines: [],
  failureModes: [],
  recoveryStrategies: [],
  decisions: [],
  risks: [],
  businessRules: [],
  constraints: []
};

export async function aiEnhanceMentalModel(
  client: AIClient,
  input: {
    projectName: string;
    purpose: string;
    primaryUsers: string[];
    criticalCapabilities: string[];
    entities?: string[];
    architectureStyle?: string;
    compliance?: string[];
    targetLatency?: string;
    targetConcurrency?: string;
  }
): Promise<AIMentalModelResult> {
  if (!client.isConfigured) return emptyResult;

  try {
    const { system, user } = buildMentalModelPrompt(input);
    const raw = await client.complete({ system, user, jsonMode: true, temperature: 0.4, maxTokens: 8192 });
    const obj = parseJsonObject(raw);
    const result = AIMentalModelSchema.safeParse(obj);
    if (!result.success) return emptyResult;
    const d = result.data as AIMentalModelOutput;
    return {
      ai: true,
      invariants: (d.invariants ?? []) as Invariant[],
      stateMachines: (d.stateMachines ?? []) as StateMachine[],
      failureModes: (d.failureModes ?? []) as FailureMode[],
      recoveryStrategies: (d.recoveryStrategies ?? []) as RecoveryStrategy[],
      decisions: (d.decisions ?? []) as Decision[],
      risks: (d.risks ?? []) as Risk[],
      businessRules: (d.businessRules ?? []) as BusinessRule[],
      constraints: (d.constraints ?? []) as Constraint[]
    };
  } catch {
    return emptyResult;
  }
}
