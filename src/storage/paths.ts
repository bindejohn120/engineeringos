import * as path from 'path';

export const ENG_DIR = '.engineeringos';

export interface EngineeringOSPaths {
  root: string;
  config: string;
  map: string;
  mentalModel: string;
  guardrails: string;
  blueprint: string;
  generated: string;
  generatedMap: string;
  generatedMentalModel: string;
  generatedGuardrails: string;
  generatedBlueprint: string;
  contexts: string;
  decisions: string;
  snapshots: string;
  sessions: string;
  evidence: string;
}

export function resolvePaths(workspacePath: string): EngineeringOSPaths {
  const root = path.join(workspacePath, ENG_DIR);
  const generated = path.join(root, 'generated');
  return {
    root,
    config: path.join(root, 'config.json'),
    map: path.join(root, 'map.json'),
    mentalModel: path.join(root, 'mental-model.json'),
    guardrails: path.join(root, 'guardrails.json'),
    blueprint: path.join(root, 'blueprint.json'),
    generated,
    generatedMap: path.join(generated, 'map.md'),
    generatedMentalModel: path.join(generated, 'mental-model.md'),
    generatedGuardrails: path.join(generated, 'guardrails.md'),
    generatedBlueprint: path.join(generated, 'blueprint.md'),
    contexts: path.join(generated, 'contexts'),
    decisions: path.join(root, 'decisions'),
    snapshots: path.join(root, 'snapshots'),
    sessions: path.join(root, 'sessions'),
    evidence: path.join(root, 'evidence')
  };
}
