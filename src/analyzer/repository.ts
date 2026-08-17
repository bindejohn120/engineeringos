import type {
  RepositoryAnalyzer, RepositorySnapshot, ArchitectureGraph,
  ModuleNode, DataNode, ContractNode, WorkflowNode, OwnershipNode,
  InfrastructureNode
} from './types';
import { TypeScriptAnalyzer } from './typescript';

export { TypeScriptAnalyzer } from './typescript';
export type {
  RepositoryAnalyzer, RepositorySnapshot, ArchitectureGraph,
  FileEvidence, SymbolEvidence, ImportEdge, ExportEdge,
  ContractEvidence, DataAccessEvidence, TestEvidence,
  ConfigEvidence, SecurityEvidence, OwnershipEvidence, InfrastructureEvidence,
  ModuleNode, DataNode, ContractNode, WorkflowNode, OwnershipNode, InfrastructureNode
} from './types';

const ANALYZERS: RepositoryAnalyzer[] = [new TypeScriptAnalyzer()];

export async function detectAnalyzers(root: string): Promise<RepositoryAnalyzer[]> {
  const active: RepositoryAnalyzer[] = [];
  for (const a of ANALYZERS) {
    if (await a.detectWorkspace(root)) active.push(a);
  }
  return active.length > 0 ? active : [new TypeScriptAnalyzer()];
}

export async function collectSnapshot(
  root: string,
  analyzers?: RepositoryAnalyzer[]
): Promise<RepositorySnapshot> {
  const active = analyzers ?? await detectAnalyzers(root);
  const allFiles = [];
  const allSymbols = [];
  const allImports = [];
  const allExports = [];
  const allContracts = [];
  const allDataAccess = [];
  const allTests = [];
  const allConfigs = [];
  const allSecurity = [];
  const allOwnership = [];
  const allInfra = [];

  for (const a of active) {
    const files = await a.collectFiles(root);
    allFiles.push(...files);
    allSymbols.push(...await a.buildSymbols(files));
    allImports.push(...await a.buildImports(files));
    allExports.push(...await a.buildExports(files));
    allContracts.push(...await a.buildContracts(files));
    allDataAccess.push(...await a.buildDataAccess(files));
    allTests.push(...await a.buildTests(files));
    allConfigs.push(...await aConfigs(root, a));
    allSecurity.push(...await a.buildSecurity(files));
    allOwnership.push(...await a.buildOwnership(root, files));
    allInfra.push(...await a.buildInfrastructure(root));
  }

  const langCounts: Record<string, number> = {};
  for (const f of allFiles) {
    langCounts[f.language] = (langCounts[f.language] ?? 0) + 1;
  }

  const commitSha = getCommitSha(root);

  return {
    timestamp: new Date().toISOString(),
    commitSha,
    rootPath: root,
    files: allFiles,
    symbols: allSymbols,
    imports: allImports,
    exports: allExports,
    contracts: allContracts,
    dataAccess: allDataAccess,
    tests: allTests,
    configs: allConfigs,
    ownership: allOwnership,
    security: allSecurity,
    infrastructure: allInfra,
    stats: {
      totalFiles: allFiles.length,
      totalLines: 0,
      languages: langCounts,
      testFiles: allTests.length,
      testToSourceRatio: allFiles.length > 0 ? allTests.length / allFiles.length : 0
    }
  };
}

async function aConfigs(root: string, a: RepositoryAnalyzer) {
  return a.buildConfigs?.(root) ?? [];
}

export function buildArchitectureGraph(snapshot: RepositorySnapshot): ArchitectureGraph {
  const modules: ModuleNode[] = [];
  const dirGroups = new Map<string, string[]>();
  for (const f of snapshot.files) {
    const dir = f.path.split('/').slice(0, -1).join('/') || '.';
    const existing = dirGroups.get(dir) ?? [];
    existing.push(f.path);
    dirGroups.set(dir, existing);
  }

  for (const [dir, files] of dirGroups) {
    const symbols = snapshot.symbols.filter(s => files.includes(s.file));
    const tests = snapshot.tests.filter(t => files.includes(t.file));
    const exports_ = snapshot.exports.filter(e => files.includes(e.file));
    modules.push({
      id: `MOD-${dir.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 40)}`,
      path: dir,
      name: dir.split('/').pop() ?? dir,
      kind: files.length > 1 ? 'directory' : 'file',
      language: files.length > 0 ? (snapshot.files.find(f => f.path === files[0])?.language ?? 'unknown') : 'unknown',
      symbols: symbols.map(s => s.name),
      exports: exports_.map(e => e.symbol),
      tests: tests.map(t => t.file)
    });
  }

  const data: DataNode[] = [];
  const dataTargets = new Map<string, { readers: Set<string>; writers: Set<string> }>();
  for (const d of snapshot.dataAccess) {
    const existing = dataTargets.get(d.target) ?? { readers: new Set(), writers: new Set() };
    if (d.kind === 'read') existing.readers.add(d.file);
    else existing.writers.add(d.file);
    dataTargets.set(d.target, existing);
  }
  let di = 0;
  for (const [target, { readers, writers }] of dataTargets) {
    data.push({
      id: `DS-${String(++di).padStart(3, '0')}`,
      name: target,
      kind: 'table',
      readers: Array.from(readers),
      writers: Array.from(writers)
    });
  }

  const contracts: ContractNode[] = snapshot.contracts.map((c, i) => ({
    id: `CTR-${String(i + 1).padStart(3, '0')}`,
    type: c.type,
    path: c.file,
    method: c.method,
    route: c.path,
    provider: c.file,
    consumers: []
  }));

  const workflows: WorkflowNode[] = [];
  const ownership: OwnershipNode[] = snapshot.ownership
    .filter(o => o.lastAuthor)
    .reduce((acc: OwnershipNode[], o) => {
      const existing = acc.find(a => a.name === o.lastAuthor);
      if (existing) existing.components.push(o.file);
      else acc.push({ id: `OWN-${acc.length + 1}`, name: o.lastAuthor!, kind: 'person', components: [o.file], decisions: [] });
      return acc;
    }, []);

  const infrastructure: InfrastructureNode[] = snapshot.infrastructure.map((inf, i) => ({
    id: `INF-${String(i + 1).padStart(3, '0')}`,
    name: inf.service ?? inf.file,
    kind: inf.kind,
    resources: [inf.file],
    dependencies: []
  }));

  const edges: ArchitectureGraph['edges'] = [];
  for (const imp of snapshot.imports) {
    edges.push({ from: imp.from, to: imp.to, type: 'imports' });
  }
  for (const d of snapshot.dataAccess) {
    edges.push({ from: d.file, to: d.target, type: d.kind === 'read' ? 'reads' : 'writes' });
  }
  for (const c of contracts) {
    edges.push({ from: c.path, to: c.route ?? c.type, type: 'publishes' });
  }

  return {
    timestamp: snapshot.timestamp,
    modules,
    data,
    contracts,
    workflows,
    ownership,
    infrastructure,
    edges
  };
}

function getCommitSha(root: string): string | null {
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return null;
  }
}
