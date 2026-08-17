import type { Invariant, MentalModel, Unknown, Risk, Assumption, StateMachine, CausalRelationship } from '../core/types';

export function createMentalModel(purpose: string): MentalModel {
  const now = new Date().toISOString();
  return {
    schemaVersion: '1.0',
    modelVersion: 0,
    updatedAt: now,
    basedOnCommit: null,
    systemUnderstanding: {
      purpose,
      primaryUsers: [],
      businessObjective: '',
      criticalCapabilities: []
    },
    entities: [],
    relationships: [],
    causalRelationships: [],
    businessRules: [],
    invariants: [],
    stateMachines: [],
    workflows: [],
    failureModes: [],
    recoveryStrategies: [],
    architecturalPrinciples: [],
    decisions: [],
    assumptions: [],
    unknowns: [],
    constraints: [],
    currentState: { summary: '', modelStage: 'DRAFT' },
    intendedState: { summary: '' },
    risks: [],
    predictions: [],
    evidence: []
  };
}

export function addInvariant(model: MentalModel, invariant: Invariant): MentalModel {
  const existing = model.invariants.some((i) => i.id === invariant.id);
  const invariants = existing
    ? model.invariants.map((i) => (i.id === invariant.id ? invariant : i))
    : [...model.invariants, invariant];
  return { ...model, invariants };
}

export function addUnknown(model: MentalModel, unknown: Unknown): MentalModel {
  const existing = model.unknowns.some((u) => u.id === unknown.id);
  const unknowns = existing
    ? model.unknowns.map((u) => (u.id === unknown.id ? unknown : u))
    : [...model.unknowns, unknown];
  return { ...model, unknowns };
}

export function addRisk(model: MentalModel, risk: Risk): MentalModel {
  const existing = model.risks.some((r) => r.id === risk.id);
  const risks = existing
    ? model.risks.map((r) => (r.id === risk.id ? risk : r))
    : [...model.risks, risk];
  return { ...model, risks };
}

export function addAssumption(model: MentalModel, assumption: Assumption): MentalModel {
  const existing = model.assumptions.some((a) => a.id === assumption.id);
  const assumptions = existing
    ? model.assumptions.map((a) => (a.id === assumption.id ? assumption : a))
    : [...model.assumptions, assumption];
  return { ...model, assumptions };
}

export function addStateMachine(model: MentalModel, machine: StateMachine): MentalModel {
  const existing = model.stateMachines.some((s) => s.entity === machine.entity);
  const stateMachines = existing
    ? model.stateMachines.map((s) => (s.entity === machine.entity ? machine : s))
    : [...model.stateMachines, machine];
  return { ...model, stateMachines };
}

export function addCausalRelationship(model: MentalModel, causal: CausalRelationship): MentalModel {
  const existing = model.causalRelationships.some((c) => c.id === causal.id);
  const causalRelationships = existing
    ? model.causalRelationships.map((c) => (c.id === causal.id ? causal : c))
    : [...model.causalRelationships, causal];
  return { ...model, causalRelationships };
}

export function setCurrentState(model: MentalModel, summary: string, modelStage: string): MentalModel {
  return { ...model, currentState: { summary, modelStage } };
}
