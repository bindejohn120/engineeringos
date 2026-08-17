import type { AIClient } from './provider';
import type {
  Map,
  MentalModel,
  Guardrails,
  Blueprint,
  Component,
  Relationship,
  Workflow
} from '../core/types';
import { addComponent, addRelationship, addWorkflow } from '../map/engine';
import { aiGenerateDomainModel } from './domain-model';
import { aiEnhanceMentalModel } from './mental-model';
import { aiGenerateGuardrails } from './guardrails';
import { aiGenerateThreatModel } from './threat-model';
import { aiEnhanceBlueprint } from './blueprint';
import type { BlueprintSeedInput } from '../blueprint/engine';

export interface PipelineInput {
  client: AIClient;
  map: Map;
  mentalModel: MentalModel;
  guardrails: Guardrails;
  blueprint: Blueprint;
  projectName: string;
  purpose: string;
  primaryUsers: string[];
  criticalCapabilities: string[];
  architectureStyle?: string;
  language?: string;
  framework?: string;
  database?: string;
  compliance?: string[];
  targetLatency?: string;
  targetConcurrency?: string;
  securityLevel?: string;
  onProgress?: (phase: string, progress: number) => void;
}

export interface PipelineResult {
  map: Map;
  mentalModel: MentalModel;
  guardrails: Guardrails;
  blueprint: Blueprint;
  notes: string[];
  domainEntities: string[];
  threats: number;
  aiEnhanced: boolean;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function nextId(prefix: string, existing: { id: string }[]): number {
  let max = 0;
  for (const item of existing) {
    const match = item.id.match(new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`, 'i'));
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

function severityForThreat(level: 'low' | 'medium' | 'high' | 'critical'): 'advisory' | 'warning' | 'blocking' {
  if (level === 'critical' || level === 'high') return 'blocking';
  if (level === 'medium') return 'warning';
  return 'advisory';
}

export async function runAIPipeline(input: PipelineInput): Promise<PipelineResult> {
  const {
    client,
    map: initialMap,
    mentalModel: initialMentalModel,
    guardrails: initialGuardrails,
    blueprint: initialBlueprint,
    projectName,
    purpose,
    primaryUsers,
    criticalCapabilities,
    architectureStyle,
    language,
    framework,
    database,
    compliance,
    targetLatency,
    targetConcurrency,
    securityLevel,
    onProgress
  } = input;

  const notes: string[] = [];
  let mapResult = structuredClone(initialMap);
  let mentalModelResult = structuredClone(initialMentalModel);
  let guardrailsResult = structuredClone(initialGuardrails);
  let blueprintResult = structuredClone(initialBlueprint);
  let domainEntities: string[] = [];
  let threats = 0;
  let anyAi = false;

  const entityNames = (): string[] => mapResult.components.map((c) => c.name);

  // ── Pass 1: Domain Model ──────────────────────────────────────────────
  onProgress?.('domain-model', 0);
  try {
    const domainResult = await aiGenerateDomainModel(client, {
      projectName,
      purpose,
      primaryUsers,
      criticalCapabilities,
      architectureStyle,
      language,
      framework,
      database
    });

    const hasEntities = domainResult.entities.length > 0;
    anyAi = anyAi || hasEntities;

    if (hasEntities) {
      domainEntities = domainResult.entities.map((e) => e.name);

      for (const entity of domainResult.entities) {
        const component: Component = {
          id: `comp-ai-${slugify(entity.name)}`,
          name: entity.name,
          purpose: entity.description,
          responsibilities: [entity.description],
          inputs: entity.properties.filter((p) => p.required).map((p) => p.name),
          outputs: entity.properties.filter((p) => !p.required).map((p) => p.name),
          dependencies: entity.relationships.map((r) => r.target),
          dependents: [],
          interfaces: entity.relationships.map((r) => `${r.type}: ${r.target}`),
          failureModes: [],
          sourceLocations: []
        };
        mapResult = addComponent(mapResult, component);
      }

      for (const entity of domainResult.entities) {
        for (const rel of entity.relationships) {
          const relationship: Relationship = {
            id: `rel-ai-${slugify(entity.name)}-${slugify(rel.target)}-${slugify(rel.type)}`,
            from: `comp-ai-${slugify(entity.name)}`,
            to: `comp-ai-${slugify(rel.target)}`,
            type: rel.type,
            description: rel.description
          };
          mapResult = addRelationship(mapResult, relationship);
        }
      }

      for (const event of domainResult.domainEvents) {
        const workflow: Workflow = {
          id: `wf-ai-event-${slugify(event.name)}`,
          name: event.name,
          description: `Domain event triggered by: ${event.trigger}`,
          steps: [event.trigger],
          components: [],
          inputs: [event.trigger],
          outputs: Object.keys(event.payload)
        };
        mapResult = addWorkflow(mapResult, workflow);
      }

      mapResult.updatedAt = new Date().toISOString();
      notes.push(
        `Pass 1 (Domain Model): OK — ${domainResult.entities.length} entities, ` +
          `${domainResult.valueObjects.length} value objects, ` +
          `${domainResult.boundedContexts.length} bounded contexts, ` +
          `${domainResult.domainEvents.length} domain events.`
      );
    } else {
      notes.push('Pass 1 (Domain Model): no entities returned by AI.');
    }
  } catch (err) {
    notes.push(`Pass 1 (Domain Model): FAILED — ${err instanceof Error ? err.message : String(err)}`);
  }
  onProgress?.('domain-model', 100);

  // ── Pass 2: Mental Model Enhancement ──────────────────────────────────
  onProgress?.('mental-model', 0);
  try {
    const mentalResult = await aiEnhanceMentalModel(client, {
      projectName,
      purpose,
      primaryUsers,
      criticalCapabilities,
      entities: entityNames(),
      architectureStyle,
      compliance,
      targetLatency,
      targetConcurrency
    });

    const hasContent =
      mentalResult.invariants.length > 0 ||
      mentalResult.stateMachines.length > 0 ||
      mentalResult.failureModes.length > 0 ||
      mentalResult.risks.length > 0 ||
      mentalResult.decisions.length > 0 ||
      mentalResult.businessRules.length > 0 ||
      mentalResult.recoveryStrategies.length > 0;
    anyAi = anyAi || hasContent;

    if (hasContent) {
      const invNext = nextId('INV-AI', mentalModelResult.invariants);
      for (let i = 0; i < mentalResult.invariants.length; i++) {
        const inv = mentalResult.invariants[i];
        mentalModelResult.invariants.push({
          ...inv,
          id: `INV-AI-${invNext + i}`
        });
      }

      mentalModelResult.stateMachines.push(...mentalResult.stateMachines);

      mentalModelResult.failureModes.push(...mentalResult.failureModes);

      mentalModelResult.risks.push(...mentalResult.risks);

      mentalModelResult.decisions.push(...mentalResult.decisions);

      mentalModelResult.businessRules.push(...mentalResult.businessRules);

      mentalModelResult.recoveryStrategies.push(...mentalResult.recoveryStrategies);

      mentalModelResult.updatedAt = new Date().toISOString();
      notes.push(
        `Pass 2 (Mental Model): OK — ` +
          `${mentalResult.invariants.length} invariants, ` +
          `${mentalResult.stateMachines.length} state machines, ` +
          `${mentalResult.failureModes.length} failure modes, ` +
          `${mentalResult.risks.length} risks, ` +
          `${mentalResult.decisions.length} decisions, ` +
          `${mentalResult.businessRules.length} business rules, ` +
          `${mentalResult.recoveryStrategies.length} recovery strategies.`
      );
    } else {
      notes.push('Pass 2 (Mental Model): no enhancements returned by AI.');
    }
  } catch (err) {
    notes.push(`Pass 2 (Mental Model): FAILED — ${err instanceof Error ? err.message : String(err)}`);
  }
  onProgress?.('mental-model', 100);

  // ── Pass 3: Guardrails ────────────────────────────────────────────────
  onProgress?.('guardrails', 0);
  try {
    const guardrailsOutput = await aiGenerateGuardrails(client, {
      projectName,
      purpose,
      language,
      framework,
      database,
      entities: entityNames(),
      compliance,
      securityLevel
    });

    const hasGuardrails = guardrailsOutput.guardrails.length > 0;
    anyAi = anyAi || hasGuardrails;

    if (hasGuardrails) {
      guardrailsResult.guardrails.push(...guardrailsOutput.guardrails);
      guardrailsResult.updatedAt = new Date().toISOString();
      notes.push(`Pass 3 (Guardrails): OK — ${guardrailsOutput.guardrails.length} guardrails added.`);
    } else {
      notes.push('Pass 3 (Guardrails): no guardrails returned by AI.');
    }
  } catch (err) {
    notes.push(`Pass 3 (Guardrails): FAILED — ${err instanceof Error ? err.message : String(err)}`);
  }
  onProgress?.('guardrails', 100);

  // ── Pass 4: Blueprint Enhancement ─────────────────────────────────────
  onProgress?.('blueprint', 0);
  try {
    const blueprintSeed: BlueprintSeedInput = {
      projectName,
      projectId: mapResult.project.id ?? slugify(projectName),
      purpose,
      primaryUsers,
      criticalCapabilities,
      options: {
        architectureStyle,
        language,
        framework,
        database,
        securityLevel: securityLevel as 'baseline' | 'hardened' | 'regulated' | undefined,
        sourceSpec: [
          targetLatency ? `Target latency: ${targetLatency}` : '',
          targetConcurrency ? `Target concurrency: ${targetConcurrency}` : '',
          compliance && compliance.length > 0 ? `Compliance: ${compliance.join(', ')}` : ''
        ].filter(Boolean).join('\n')
      }
    };

    const blueprintOutput = await aiEnhanceBlueprint(client, blueprintResult, blueprintSeed);
    anyAi = anyAi || blueprintOutput.ai;

    if (blueprintOutput.ai) {
      blueprintResult = blueprintOutput.blueprint;
      blueprintResult.updatedAt = new Date().toISOString();
      notes.push(`Pass 4 (Blueprint): OK — ${blueprintResult.sections.length} sections, style=${blueprintResult.architectureStyle}.`);
    } else {
      notes.push(`Pass 4 (Blueprint): ${blueprintOutput.note ?? 'AI not enabled or returned no result.'}`);
    }
  } catch (err) {
    notes.push(`Pass 4 (Blueprint): FAILED — ${err instanceof Error ? err.message : String(err)}`);
  }
  onProgress?.('blueprint', 100);

  // ── Pass 5: Threat Model ──────────────────────────────────────────────
  onProgress?.('threat-model', 0);
  try {
    const integrations = [
      ...mapResult.services.map((s) => s.name),
      ...mapResult.externalSystems.map((e) => e.name),
      ...mapResult.dataStores.map((d) => d.name)
    ];

    const threatOutput = await aiGenerateThreatModel(client, {
      projectName,
      purpose,
      entities: entityNames(),
      integrations,
      compliance,
      securityLevel
    });

    const hasThreats = threatOutput.threats.length > 0;
    const hasSecReqs = threatOutput.securityRequirements.length > 0;
    anyAi = anyAi || hasThreats || hasSecReqs;

    if (hasThreats || hasSecReqs) {
      threats = threatOutput.threats.length;

      for (const threat of threatOutput.threats) {
        const severity = severityForThreat(threat.severity);
        mentalModelResult.invariants.push({
          id: `INV-AI-SEC-${nextId('INV-AI-SEC', mentalModelResult.invariants)}`,
          statement: `[${threat.stride}] ${threat.threat} — Mitigation: ${threat.mitigation}`,
          severity,
          scope: [threat.affectedComponent],
          enforcement: ['code-review'],
          verification: []
        });
      }

      for (const sr of threatOutput.securityRequirements) {
        mentalModelResult.invariants.push({
          id: `INV-AI-SEC-${nextId('INV-AI-SEC', mentalModelResult.invariants)}`,
          statement: `[SEC-REQ] ${sr.text}`,
          severity: sr.severity,
          scope: [],
          enforcement: ['code-review'],
          verification: []
        });
      }

      mentalModelResult.updatedAt = new Date().toISOString();
      notes.push(
        `Pass 5 (Threat Model): OK — ${threats} threats, ` +
          `${threatOutput.attackSurface.length} attack surface items, ` +
          `${hasSecReqs ? threatOutput.securityRequirements.length : 0} security requirements.`
      );
    } else {
      notes.push('Pass 5 (Threat Model): no threats returned by AI.');
    }
  } catch (err) {
    notes.push(`Pass 5 (Threat Model): FAILED — ${err instanceof Error ? err.message : String(err)}`);
  }
  onProgress?.('threat-model', 100);

  return {
    map: mapResult,
    mentalModel: mentalModelResult,
    guardrails: guardrailsResult,
    blueprint: blueprintResult,
    notes,
    domainEntities,
    threats,
    aiEnhanced: anyAi
  };
}
