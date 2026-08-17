import { sourceLocationsExist, unmappedSourceLocations } from '../map/engine';
import type { DriftFinding, DriftReport, Map, MentalModel, UpdateProposal } from '../core/types';
import type { GuardrailResult } from '../core/types';

export interface DriftInput {
  map: Map;
  mentalModel: MentalModel;
  files: string[];
  guardrailResults: GuardrailResult[];
}

export function detectDrift(input: DriftInput): DriftReport {
  const findings: DriftFinding[] = [];
  const { map, files, guardrailResults } = input;

  // Model -> Code: component sourceLocations resolve to nothing
  const allComponents = [
    ...map.components.map((c) => ({ id: c.id, name: c.name, locations: c.sourceLocations })),
    ...map.services.map((s) => ({ id: s.id, name: s.name, locations: s.sourceLocations })),
    ...map.dataStores.map((d) => ({ id: d.id, name: d.name, locations: d.sourceLocations }))
  ];

  for (const component of allComponents) {
    if (component.locations.length > 0 && !sourceLocationsExist(files, component.locations)) {
      findings.push({
        id: `drift-model-code-${component.id}`,
        driftType: 'model-to-code',
        severity: 'warning',
        title: `Model → Code drift: ${component.name}`,
        description: `Model declares source locations that match no current files.`,
        evidence: [...component.locations],
        proposedChange: `Update sourceLocations for ${component.id} or remove the component if it no longer exists.`,
        confidence: 0.8
      });
    }
  }

  // Code -> Model: files exist that no component covers
  const unmapped = unmappedSourceLocations(files, map);
  if (unmapped.length > 0) {
    findings.push({
      id: 'drift-code-model-surface',
      driftType: 'code-to-model',
      severity: 'warning',
      title: 'Code → Model drift: unmapped source surface',
      description: 'Source files exist that are not covered by any component sourceLocations.',
      evidence: unmapped.slice(0, 10),
      proposedChange: 'Map these files to a component or update sourceLocations.',
      confidence: 0.7
    });
  }

  // Requirement -> Implementation
  for (const req of map.requirements) {
    if (req.status === 'open' && req.evidence.length === 0) {
      findings.push({
        id: `drift-req-impl-${req.id}`,
        driftType: 'requirement-to-implementation',
        severity: 'advisory',
        title: `Requirement → Implementation drift: ${req.id}`,
        description: `Open requirement '${req.text}' has no implementation evidence.`,
        evidence: [],
        proposedChange: `Confirm whether ${req.id} is implemented and mark it implemented/verified with evidence.`,
        confidence: 0.6
      });
    }
  }

  // Guardrail -> Code
  for (const result of guardrailResults) {
    if (result.status === 'fail') {
      findings.push({
        id: `drift-guardrail-code-${result.ruleId}`,
        driftType: 'guardrail-to-code',
        severity: result.severity,
        title: `Guardrail → Code drift: ${result.ruleName}`,
        description: `Code violates guardrail ${result.ruleId} (${result.ruleName}).`,
        evidence: result.signals.map((s) => s.file),
        proposedChange: `Correct the violation or update the guardrail if it no longer applies.`,
        confidence: 0.9
      });
    }
  }

  const updateProposal = buildUpdateProposal(findings);
  return { findings, updateProposal };
}

export function buildUpdateProposal(findings: DriftFinding[]): UpdateProposal {
  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];

  for (const finding of findings) {
    if (finding.driftType === 'code-to-model' && finding.proposedChange) {
      added.push(finding.proposedChange);
    } else if (finding.driftType === 'model-to-code' && finding.proposedChange) {
      if (finding.proposedChange.includes('remove')) removed.push(finding.proposedChange);
      else changed.push(finding.proposedChange);
    } else if (finding.proposedChange) {
      changed.push(finding.proposedChange);
    }
  }

  return {
    added: dedupe(added),
    changed: dedupe(changed),
    removed: dedupe(removed),
    confidence: findings.length > 0 ? Math.max(0.5, 0.85 - findings.length * 0.03) : 1,
    basedOn: findings.map((f) => f.id)
  };
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}
