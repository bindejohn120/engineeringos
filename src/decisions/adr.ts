export type ADRStatus = 'proposed' | 'accepted' | 'superseded' | 'rejected' | 'deprecated';

export interface ADR {
  id: string;
  title: string;
  status: ADRStatus;
  context: string;
  decision: string;
  constraints: string[];
  alternatives: string[];
  consequences: string[];
  rollbackPlan: string;
  affectedModules: string[];
  affectedContracts: string[];
  validationCriteria: string[];
  owner: string;
  approver?: string;
  proposedAt: string;
  acceptedAt?: string;
  supersededBy?: string;
  supersersedes?: string;
  links: ADRLink[];
  tags: string[];
}

export interface ADRLink {
  kind: 'test' | 'implementation' | 'evidence' | 'change' | 'dependency';
  target: string;
  description?: string;
}

export interface ADRRegistry {
  schemaVersion: string;
  adrs: ADR[];
  lastUpdated: string;
}

export function createADRRegistry(): ADRRegistry {
  return { schemaVersion: '1.0', adrs: [], lastUpdated: new Date().toISOString() };
}

export function createADR(overrides: Omit<ADR, 'proposedAt'>): ADR {
  return { ...overrides, proposedAt: new Date().toISOString() };
}

export function acceptADR(registry: ADRRegistry, id: string, approver: string): ADR | null {
  const adr = registry.adrs.find(a => a.id === id);
  if (!adr) return null;
  adr.status = 'accepted';
  adr.approver = approver;
  adr.acceptedAt = new Date().toISOString();
  registry.lastUpdated = new Date().toISOString();
  return adr;
}

export function supersedeADR(registry: ADRRegistry, oldId: string, newId: string): boolean {
  const old = registry.adrs.find(a => a.id === oldId);
  const newer = registry.adrs.find(a => a.id === newId);
  if (!old || !newer) return false;
  old.status = 'superseded';
  old.supersededBy = newId;
  newer.status = 'accepted';
  newer.supersersedes = oldId;
  registry.lastUpdated = new Date().toISOString();
  return true;
}

export interface ADRViolation {
  adrId: string;
  kind: 'missing' | 'stale' | 'contradicted' | 'unowned' | 'unlinked';
  message: string;
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  evidence: string[];
}

export function detectADRViolations(
  registry: ADRRegistry,
  context: {
    newExternalDependencies?: string[];
    newServiceBoundaries?: string[];
    schemaChanges?: string[];
    publicAPIChanges?: string[];
    implementedModules?: string[];
  }
): ADRViolation[] {
  const violations: ADRViolation[] = [];

  for (const dep of context.newExternalDependencies ?? []) {
    const hasADR = registry.adrs.some(a =>
      a.status === 'accepted' && a.decision.toLowerCase().includes(dep.toLowerCase())
    );
    if (!hasADR) {
      violations.push({
        adrId: '',
        kind: 'missing',
        message: `New external dependency "${dep}" has no associated ADR`,
        severity: 'BLOCKING',
        evidence: [`dependency: ${dep}`]
      });
    }
  }

  for (const bound of context.newServiceBoundaries ?? []) {
    const hasADR = registry.adrs.some(a =>
      a.status === 'accepted' && a.title.toLowerCase().includes(bound.toLowerCase())
    );
    if (!hasADR) {
      violations.push({
        adrId: '',
        kind: 'missing',
        message: `New service boundary "${bound}" has no associated ADR`,
        severity: 'BLOCKING',
        evidence: [`boundary: ${bound}`]
      });
    }
  }

  for (const api of context.publicAPIChanges ?? []) {
    const hasADR = registry.adrs.some(a =>
      a.status === 'accepted' && a.affectedContracts.some(c => c.includes(api))
    );
    if (!hasADR) {
      violations.push({
        adrId: '',
        kind: 'missing',
        message: `Public API change "${api}" has no associated ADR`,
        severity: 'WARNING',
        evidence: [`api: ${api}`]
      });
    }
  }

  for (const adr of registry.adrs) {
    if (adr.status === 'accepted' && !adr.owner) {
      violations.push({
        adrId: adr.id,
        kind: 'unowned',
        message: `ADR "${adr.id}" has no owner assigned`,
        severity: 'INFO',
        evidence: [`adr: ${adr.id}`]
      });
    }
  }

  return violations;
}
