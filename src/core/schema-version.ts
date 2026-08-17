export const CURRENT_SCHEMA_VERSION = '2.0.0';

export interface SchemaVersionInfo {
  version: string;
  createdAt: string;
  migratedFrom?: string;
  compatibility: 'full' | 'partial' | 'breaking';
}

export function parseVersion(v: string): [number, number, number] {
  const parts = v.split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function isCompatible(current: string, required: string): boolean {
  const [cMaj, cMin] = parseVersion(current);
  const [rMaj, rMin] = parseVersion(required);
  if (cMaj !== rMaj) return false;
  return cMin >= rMin;
}

export function shouldMigrate(current: string, target: string): boolean {
  return current !== target;
}

export function createVersionInfo(migratedFrom?: string): SchemaVersionInfo {
  return {
    version: CURRENT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    migratedFrom,
    compatibility: migratedFrom ? 'full' : 'full'
  };
}

export function bumpVersion(
  current: string,
  change: 'major' | 'minor' | 'patch'
): string {
  const [maj, min, pat] = parseVersion(current);
  switch (change) {
    case 'major': return `${maj + 1}.0.0`;
    case 'minor': return `${maj}.${min + 1}.0`;
    case 'patch': return `${maj}.${min}.${pat + 1}`;
  }
}

export const ARTIFACT_SCHEMAS: Record<string, string> = {
  'config.json': '1.0',
  'map.json': '2.0',
  'mental-model.json': '2.0',
  'guardrails.json': '2.0',
  'reliability.json': '1.0',
  'decisions.json': '1.0',
  'invariants/registry.json': '1.0',
  'invariants/coverage.json': '1.0',
  'ownership.json': '1.0',
  'blueprint.json': '1.0',
  'state.json': '1.0'
};

export function artifactNeedsMigration(
  artifact: string,
  currentVersion: string
): boolean {
  const required = ARTIFACT_SCHEMAS[artifact];
  if (!required) return false;
  return !isCompatible(currentVersion, required);
}
