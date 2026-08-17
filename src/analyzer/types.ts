export interface FileEvidence {
  path: string;
  language: string;
  size: number;
  lastModified: string;
  sha?: string;
  encoding: 'utf-8' | 'binary';
}

export interface SymbolEvidence {
  file: string;
  name: string;
  kind: 'class' | 'function' | 'interface' | 'type' | 'constant' | 'variable' | 'enum' | 'export';
  line: number;
  endLine: number;
  exported: boolean;
  parameters?: string[];
  returnType?: string;
  decorators?: string[];
}

export interface ImportEdge {
  from: string;
  to: string;
  kind: 'esm' | 'commonjs' | 'dynamic' | 'type-only';
  symbols?: string[];
  line: number;
  isExternal: boolean;
  isBuiltin: boolean;
}

export interface ExportEdge {
  file: string;
  symbol: string;
  kind: 'named' | 'default' | 're-export';
  line: number;
}

export interface ContractEvidence {
  type: 'api-route' | 'event' | 'schema' | 'webhook' | 'queue' | 'cli-command';
  file: string;
  line: number;
  method?: string;
  path?: string;
  eventName?: string;
  schemaRef?: string;
  method_?: string;
  description?: string;
}

export interface DataAccessEvidence {
  file: string;
  line: number;
  kind: 'read' | 'write' | 'delete' | 'migrate';
  target: string;
  orm?: string;
  raw?: boolean;
}

export interface TestEvidence {
  file: string;
  describeBlock?: string;
  testName: string;
  line: number;
  sourceFile?: string;
  sourceSymbol?: string;
  kind: 'unit' | 'integration' | 'e2e' | 'property' | 'contract';
}

export interface ConfigEvidence {
  file: string;
  kind: 'env' | 'docker' | 'ci' | 'terraform' | 'kubernetes' | 'package' | 'tsconfig' | 'eslint';
  keys?: string[];
}

export interface OwnershipEvidence {
  file: string;
  owner?: string;
  lastAuthor?: string;
  lastModified?: string;
  blame?: BlameEvidence[];
}

export interface BlameEvidence {
  line: number;
  author: string;
  date: string;
  commit: string;
  message?: string;
}

export interface SecurityEvidence {
  file: string;
  line: number;
  kind: 'secret' | 'credential' | 'auth-middleware' | 'cors' | 'csrf' | 'tls';
  severity: 'critical' | 'high' | 'medium' | 'low';
  pattern: string;
  description: string;
}

export interface InfrastructureEvidence {
  file: string;
  kind: 'docker' | 'terraform' | 'kubernetes' | 'ci' | 'cdn' | 'queue' | 'database';
  service?: string;
  resources?: string[];
}

export interface RepositorySnapshot {
  timestamp: string;
  commitSha: string | null;
  rootPath: string;
  files: FileEvidence[];
  symbols: SymbolEvidence[];
  imports: ImportEdge[];
  exports: ExportEdge[];
  contracts: ContractEvidence[];
  dataAccess: DataAccessEvidence[];
  tests: TestEvidence[];
  configs: ConfigEvidence[];
  ownership: OwnershipEvidence[];
  security: SecurityEvidence[];
  infrastructure: InfrastructureEvidence[];
  stats: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
    testFiles: number;
    testToSourceRatio: number;
  };
}

export interface ModuleNode {
  id: string;
  path: string;
  name: string;
  kind: 'file' | 'directory' | 'package';
  language: string;
  symbols: string[];
  exports: string[];
  tests: string[];
  owner?: string;
}

export interface DataNode {
  id: string;
  name: string;
  kind: 'table' | 'collection' | 'file' | 'cache' | 'queue';
  schema?: string;
  owner?: string;
  readers: string[];
  writers: string[];
}

export interface ContractNode {
  id: string;
  type: ContractEvidence['type'];
  path: string;
  method?: string;
  route?: string;
  version?: string;
  provider: string;
  consumers: string[];
}

export interface WorkflowNode {
  id: string;
  name: string;
  states: string[];
  transitions: { from: string; to: string; trigger: string; guard?: string }[];
  owner?: string;
}

export interface OwnershipNode {
  id: string;
  name: string;
  kind: 'team' | 'person' | 'component';
  components: string[];
  decisions: string[];
}

export interface InfrastructureNode {
  id: string;
  name: string;
  kind: InfrastructureEvidence['kind'];
  resources: string[];
  dependencies: string[];
}

export interface ArchitectureGraph {
  timestamp: string;
  modules: ModuleNode[];
  data: DataNode[];
  contracts: ContractNode[];
  workflows: WorkflowNode[];
  ownership: OwnershipNode[];
  infrastructure: InfrastructureNode[];
  edges: {
    from: string;
    to: string;
    type: 'imports' | 'calls' | 'reads' | 'writes' | 'publishes' | 'consumes'
      | 'owns' | 'deploys' | 'depends' | 'verifies' | 'triggers';
    weight?: number;
  }[];
}

export interface RepositoryAnalyzer {
  readonly name: string;
  readonly languages: string[];
  detectWorkspace(root: string): Promise<boolean>;
  collectFiles(root: string): Promise<FileEvidence[]>;
  buildSymbols(files: FileEvidence[]): Promise<SymbolEvidence[]>;
  buildImports(files: FileEvidence[]): Promise<ImportEdge[]>;
  buildExports(files: FileEvidence[]): Promise<ExportEdge[]>;
  buildContracts(files: FileEvidence[]): Promise<ContractEvidence[]>;
  buildDataAccess(files: FileEvidence[]): Promise<DataAccessEvidence[]>;
  buildTests(files: FileEvidence[]): Promise<TestEvidence[]>;
  buildConfigs(root: string): Promise<ConfigEvidence[]>;
  buildSecurity(files: FileEvidence[]): Promise<SecurityEvidence[]>;
  buildOwnership(root: string, files: FileEvidence[]): Promise<OwnershipEvidence[]>;
  buildInfrastructure(root: string): Promise<InfrastructureEvidence[]>;
}
