import type {
  Component,
  ContextPackage,
  Guardrail,
  Guardrails,
  Invariant,
  MentalModel,
  Map as EngineeringMap
} from '../core/types';
import { estimateTokens } from '../core/knowledge';
import { matchesAny } from '../analyzer/source';

export interface TaskAnalysis {
  keywords: string[];
  phrases: string[];
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'for', 'of', 'to', 'in',
  'on', 'with', 'we', 'our', 'us', 'add', 'adds', 'adding', 'new', 'make', 'create',
  'creating', 'change', 'changes', 'changing', 'update', 'updating', 'implement',
  'implementation', 'please', 'need', 'want', 'can', 'should', 'would', 'this', 'that',
  'these', 'those', 'is', 'are', 'be', 'being', 'been', 'will', 'shall', 'must', 'do',
  'does', 'did', 'have', 'has', 'had', 'not', 'no', 'it', 'its', 'at', 'by', 'from',
  'as', 'into', 'over', 'under', 'so', 'such', 'more', 'most', 'your', 'you', 'i',
  'the', 'what', 'how', 'why', 'when', 'where', 'which', 'who', 'whom'
]);

export function analyzeTask(task: string): TaskAnalysis {
  const cleaned = task.replace(/[^\p{L}\p{N}\s-]/gu, ' ').toLowerCase();
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 1 && !STOPWORDS.has(t));
  return {
    keywords: tokens,
    phrases: extractPhrases(task)
  };
}

function extractPhrases(task: string): string[] {
  const lower = task.toLowerCase();
  const phrases: string[] = [];
  const candidates = lower.match(/[a-z][a-z\s]{3,}(?:[a-z]|flow|system|service|model|engine|api|service)/g) ?? [];
  for (const c of candidates) {
    const trimmed = c.trim();
    if (trimmed.length >= 3 && trimmed.length <= 60) phrases.push(trimmed);
  }
  return phrases;
}

function textScore(haystack: string, keywords: string[]): number {
  const lower = haystack.toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    const kw = keyword.toLowerCase();
    if (lower.includes(kw)) score += 1;
    if (lower.split(' ').some((w) => w === kw)) score += 0.5;
  }
  return score;
}

function scoreComponent(component: Component, keywords: string[]): number {
  let score = textScore(component.name, keywords) * 3;
  score += textScore(component.purpose, keywords) * 2;
  score += textScore(component.responsibilities.join(' '), keywords);
  score += textScore(component.sourceLocations.join(' '), keywords);
  return score;
}

function topByIds<T extends { id: string }>(items: T[], scores: Map<string, number>, limit: number): string[] {
  const sorted = items
    .map((item) => ({ item, score: scores.get(item.id) ?? 0 }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return sorted.slice(0, limit).map((entry) => entry.item.id);
}

export function buildContextPackage(input: {
  task: string;
  map: EngineeringMap;
  mentalModel: MentalModel;
  guardrails: Guardrails;
}): ContextPackage {
  const { task, map, mentalModel, guardrails } = input;
  const analysis = analyzeTask(task);
  const keywords = analysis.keywords;

  const componentScores = new Map<string, number>();
  for (const component of map.components) {
    componentScores.set(component.id, scoreComponent(component, keywords));
  }

  const relevantComponents = topByIds(map.components, componentScores, 8);
  const relevantRelationships = map.relationships
    .filter((r) => relevantComponents.includes(r.from) || relevantComponents.includes(r.to))
    .slice(0, 10)
    .map((r) => `${r.from} -> ${r.to} (${r.type})`);

  const invariantScores = new Map<string, number>();
  for (const invariant of mentalModel.invariants) {
    let score = textScore(invariant.statement + ' ' + invariant.scope.join(' '), keywords);
    if (
      relevantComponents.some((c) =>
        invariant.scope.some((s) => c.includes(s) || s.includes(c) || s.includes(c.replace(/-/g, ' ')))
      )
    ) {
      score += 1;
    }
    invariantScores.set(invariant.id, score);
  }
  const relevantInvariants = topByIds(mentalModel.invariants, invariantScores, 6);

  const guardrailScores = new Map<string, number>();
  for (const g of guardrails.guardrails) {
    const coversRelevantComponent = relevantComponents.some((c) => {
      const comp = map.components.find((x) => x.id === c);
      return comp ? comp.sourceLocations.some((loc) => matchesAny(loc, g.scope)) : false;
    });
    const keywordScore = textScore(g.name + ' ' + g.rule, keywords);
    guardrailScores.set(g.id, coversRelevantComponent || keywordScore > 0 ? 1 + keywordScore : 0);
  }
  const relevantGuardrails = topByIds(guardrails.guardrails, guardrailScores, 6);

  const decisionScores = new Map<string, number>();
  for (const d of mentalModel.decisions) {
    decisionScores.set(d.id, textScore(d.title + ' ' + d.decision + ' ' + d.affectedComponents.join(' '), keywords));
  }
  const relevantDecisions = topByIds(mentalModel.decisions, decisionScores, 5);

  const riskScores = new Map<string, number>();
  for (const r of mentalModel.risks) {
    riskScores.set(r.id, textScore(r.name + ' ' + r.description, keywords));
  }
  const relevantRisks = topByIds(mentalModel.risks, riskScores, 5);

  const unknownScores = new Map<string, number>();
  for (const u of mentalModel.unknowns) {
    unknownScores.set(u.id, textScore(u.question + ' ' + u.blocks.join(' '), keywords));
  }
  const relevantUnknowns = topByIds(mentalModel.unknowns, unknownScores, 4);

  const relevantRequirements = relevantRequirementsFor(map, relevantComponents, keywords);

  const verificationPlan = buildVerificationPlan(mentalModel.invariants, relevantInvariants, guardrails.guardrails, relevantGuardrails);

  const payload = {
    task,
    relevantRequirements,
    relevantComponents,
    relevantRelationships,
    relevantInvariants,
    relevantGuardrails,
    relevantDecisions,
    relevantRisks,
    unknowns: relevantUnknowns,
    verificationPlan
  };

  const estimatedTokens = estimateTokens(JSON.stringify(payload, null, 2));

  return {
    ...payload,
    estimatedTokens,
    createdAt: new Date().toISOString()
  };
}

function relevantRequirementsFor(map: EngineeringMap, components: string[], keywords: string[]): string[] {
  const byComponent = map.requirements
    .filter((r) => r.affectedComponents.some((c) => components.includes(c)))
    .map((r) => r.id);
  const byKeyword = map.requirements
    .filter((r) => textScore(r.text, keywords) > 0)
    .map((r) => r.id);
  return [...new Set([...byComponent, ...byKeyword])].slice(0, 8);
}

function buildVerificationPlan(invariants: Invariant[], relevantInvariants: string[], guardrails: Guardrail[], relevantGuardrails: string[]): string[] {
  const plan: string[] = [];
  for (const id of relevantInvariants) {
    const invariant = invariants.find((i) => i.id === id);
    if (invariant) plan.push(`Invariant: ${invariant.statement}`);
  }
  for (const id of relevantGuardrails) {
    const guardrail = guardrails.find((g) => g.id === id);
    if (guardrail) plan.push(`Guardrail: ${guardrail.rule}`);
  }
  return plan.slice(0, 10);
}

export function summarizeContext(pkg: ContextPackage): {
  files: number;
  estimatedTokens: number;
  contains: string[];
  doesNotContain: string[];
} {
  return {
    files: pkg.relevantComponents.length,
    estimatedTokens: pkg.estimatedTokens,
    contains: [
      ...(pkg.relevantComponents.length > 0 ? ['architecture'] : []),
      ...(pkg.relevantInvariants.length > 0 ? ['invariants'] : []),
      ...(pkg.relevantGuardrails.length > 0 ? ['guardrails'] : []),
      ...(pkg.relevantDecisions.length > 0 ? ['decisions'] : [])
    ],
    doesNotContain: ['secrets', 'environment variables', 'unrelated subsystems']
  };
}

export { textScore };
