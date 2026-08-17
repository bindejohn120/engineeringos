export type ObjectType =
  | 'component' | 'requirement' | 'invariant' | 'guardrail'
  | 'decision' | 'signal' | 'rule' | 'contract'
  | 'workflow' | 'datastore' | 'external' | 'actor'
  | 'risk' | 'unknown' | 'assumption' | 'constraint'
  | 'test' | 'evidence' | 'change' | 'approval';

const COUNTERS: Record<string, number> = {};

export function resetCounters(): void {
  for (const key of Object.keys(COUNTERS)) delete COUNTERS[key];
}

export function generateId(type: ObjectType, prefix?: string): string {
  const p = prefix ?? typePrefix(type);
  const n = (COUNTERS[p] ?? 0) + 1;
  COUNTERS[p] = n;
  return `${p}-${String(n).padStart(3, '0')}`;
}

export function parseId(id: string): { prefix: string; number: number } | null {
  const m = id.match(/^([A-Z]+)-(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], number: Number(m[2]) };
}

export function idType(id: string): ObjectType | null {
  const parsed = parseId(id);
  if (!parsed) return null;
  return prefixType(parsed.prefix);
}

function typePrefix(type: ObjectType): string {
  const map: Record<ObjectType, string> = {
    component: 'CMP', requirement: 'REQ', invariant: 'INV',
    guardrail: 'GR', decision: 'DEC', signal: 'SIG',
    rule: 'RL', contract: 'CTR', workflow: 'WF',
    datastore: 'DS', external: 'EXT', actor: 'ACT',
    risk: 'RSK', unknown: 'UNK', assumption: 'ASM',
    constraint: 'CON', test: 'TST', evidence: 'EVD',
    change: 'CHG', approval: 'APR'
  };
  return map[type];
}

function prefixType(prefix: string): ObjectType | null {
  const reverse: Record<string, ObjectType> = {
    CMP: 'component', REQ: 'requirement', INV: 'invariant',
    GR: 'guardrail', DEC: 'decision', SIG: 'signal',
    RL: 'rule', CTR: 'contract', WF: 'workflow',
    DS: 'datastore', EXT: 'external', ACT: 'actor',
    RSK: 'risk', UNK: 'unknown', ASM: 'assumption',
    CON: 'constraint', TST: 'test', EVD: 'evidence',
    CHG: 'change', APR: 'approval'
  };
  return reverse[prefix] ?? null;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function stableId(type: ObjectType, name: string): string {
  return `${typePrefix(type)}-${slugify(name).replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}
