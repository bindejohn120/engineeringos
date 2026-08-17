import * as fs from 'fs';
import * as path from 'path';
import type {
  RepositoryAnalyzer, FileEvidence, SymbolEvidence, ImportEdge,
  ExportEdge, ContractEvidence, DataAccessEvidence, TestEvidence,
  ConfigEvidence, SecurityEvidence, OwnershipEvidence, InfrastructureEvidence
} from './types';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.engineeringos', 'coverage', '.vscode-test']);

export class TypeScriptAnalyzer implements RepositoryAnalyzer {
  readonly name = 'typescript';
  readonly languages = ['typescript', 'javascript'];

  async detectWorkspace(root: string): Promise<boolean> {
    const candidates = ['package.json', 'tsconfig.json', 'jsconfig.json'];
    for (const c of candidates) {
      if (fs.existsSync(path.join(root, c))) return true;
    }
    return false;
  }

  async collectFiles(root: string): Promise<FileEvidence[]> {
    const files: FileEvidence[] = [];
    this.walkDir(root, files, root);
    return files;
  }

  private walkDir(dir: string, acc: FileEvidence[], root: string): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        this.walkDir(full, acc, root);
        continue;
      }
      const ext = path.extname(e.name).toLowerCase();
      if (!TS_EXTENSIONS.has(ext)) continue;
      try {
        const stat = fs.statSync(full);
        acc.push({
          path: path.relative(root, full).replace(/\\/g, '/'),
          language: this.detectLanguage(e.name),
          size: stat.size,
          lastModified: stat.mtime.toISOString(),
          encoding: 'utf-8'
        });
      } catch { /* skip unreadable */ }
    }
  }

  private detectLanguage(filename: string): string {
    if (filename.endsWith('.ts') || filename.endsWith('.mts') || filename.endsWith('.cts')) return 'typescript';
    return 'javascript';
  }

  async buildSymbols(files: FileEvidence[]): Promise<SymbolEvidence[]> {
    const symbols: SymbolEvidence[] = [];
    for (const f of files) {
      try {
        const content = fs.readFileSync(f.path, 'utf-8');
        this.extractSymbols(f.path, content, symbols);
      } catch { /* skip unreadable */ }
    }
    return symbols;
  }

  private extractSymbols(file: string, content: string, acc: SymbolEvidence[]): void {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ln = i + 1;

      const classMatch = line.match(/^export\s+(?:abstract\s+)?class\s+(\w+)/);
      if (classMatch) {
        acc.push({ file, name: classMatch[1], kind: 'class', line: ln, endLine: ln, exported: true });
        continue;
      }

      const funcMatch = line.match(/^export\s+(?:async\s+)?function\s+(\w+)/);
      if (funcMatch) {
        acc.push({ file, name: funcMatch[1], kind: 'function', line: ln, endLine: ln, exported: true });
        continue;
      }

      const interfaceMatch = line.match(/^export\s+interface\s+(\w+)/);
      if (interfaceMatch) {
        acc.push({ file, name: interfaceMatch[1], kind: 'interface', line: ln, endLine: ln, exported: true });
        continue;
      }

      const typeMatch = line.match(/^export\s+type\s+(\w+)/);
      if (typeMatch) {
        acc.push({ file, name: typeMatch[1], kind: 'type', line: ln, endLine: ln, exported: true });
        continue;
      }

      const constMatch = line.match(/^export\s+(?:const|let|var)\s+(\w+)/);
      if (constMatch) {
        acc.push({ file, name: constMatch[1], kind: 'constant', line: ln, endLine: ln, exported: true });
        continue;
      }

      const enumMatch = line.match(/^export\s+(?:const\s+)?enum\s+(\w+)/);
      if (enumMatch) {
        acc.push({ file, name: enumMatch[1], kind: 'enum', line: ln, endLine: ln, exported: true });
        continue;
      }

      const privateFuncMatch = line.match(/^(?:async\s+)?function\s+(\w+)/);
      if (privateFuncMatch) {
        acc.push({ file, name: privateFuncMatch[1], kind: 'function', line: ln, endLine: ln, exported: false });
        continue;
      }

      const privateClassMatch = line.match(/^(?:abstract\s+)?class\s+(\w+)/);
      if (privateClassMatch) {
        acc.push({ file, name: privateClassMatch[1], kind: 'class', line: ln, endLine: ln, exported: false });
        continue;
      }
    }
  }

  async buildImports(files: FileEvidence[]): Promise<ImportEdge[]> {
    const edges: ImportEdge[] = [];
    for (const f of files) {
      try {
        const content = fs.readFileSync(f.path, 'utf-8');
        this.extractImports(f.path, content, edges);
      } catch { /* skip */ }
    }
    return edges;
  }

  private extractImports(file: string, content: string, acc: ImportEdge[]): void {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ln = i + 1;

      const esmMatch = line.match(/^import\s+(?:type\s+)?(?:{[^}]+}|[\w*]+)\s+from\s+['"]([^'"]+)['"]/);
      if (esmMatch) {
        acc.push(this.makeImportEdge(file, esmMatch[1], 'esm', ln, line.includes('import type')));
        continue;
      }

      const reExportMatch = line.match(/^export\s+(?:type\s+)?(?:{[^}]+}|[\w*]+)\s+from\s+['"]([^'"]+)['"]/);
      if (reExportMatch) {
        acc.push(this.makeImportEdge(file, reExportMatch[1], 'esm', ln, line.includes('export type')));
        continue;
      }

      const requireMatch = line.match(/require\(\s*['"]([^'"]+)['"]\s*\)/);
      if (requireMatch) {
        acc.push(this.makeImportEdge(file, requireMatch[1], 'commonjs', ln, false));
        continue;
      }

      const dynamicMatch = line.match(/import\(\s*['"]([^'"]+)['"]\s*\)/);
      if (dynamicMatch) {
        acc.push(this.makeImportEdge(file, dynamicMatch[1], 'dynamic', ln, false));
      }
    }
  }

  private makeImportEdge(
    from: string, specifier: string, kind: ImportEdge['kind'], line: number, typeOnly: boolean
  ): ImportEdge {
    const isExternal = !specifier.startsWith('.') && !specifier.startsWith('/');
    const isBuiltin = isExternal && this.isBuiltin(specifier);
    return {
      from,
      to: specifier,
      kind: typeOnly ? 'type-only' : kind,
      line,
      isExternal,
      isBuiltin
    };
  }

  private isBuiltin(spec: string): boolean {
    const builtins = [
      'fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'util', 'events',
      'stream', 'buffer', 'child_process', 'worker_threads', 'assert', 'querystring',
      'net', 'tls', 'dns', 'zlib', 'readline', 'vm', 'module', 'process'
    ];
    return builtins.includes(spec);
  }

  async buildExports(files: FileEvidence[]): Promise<ExportEdge[]> {
    const edges: ExportEdge[] = [];
    for (const f of files) {
      try {
        const content = fs.readFileSync(f.path, 'utf-8');
        this.extractExports(f.path, content, edges);
      } catch { /* skip */ }
    }
    return edges;
  }

  private extractExports(file: string, content: string, acc: ExportEdge[]): void {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ln = i + 1;
      const namedMatch = line.match(/^export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/);
      if (namedMatch) {
        acc.push({ file, symbol: namedMatch[1], kind: line.includes('export default') ? 'default' : 'named', line: ln });
      }
    }
  }

  async buildContracts(files: FileEvidence[]): Promise<ContractEvidence[]> {
    const contracts: ContractEvidence[] = [];
    for (const f of files) {
      try {
        const content = fs.readFileSync(f.path, 'utf-8');
        this.extractContracts(f.path, content, contracts);
      } catch { /* skip */ }
    }
    return contracts;
  }

  private extractContracts(file: string, content: string, acc: ContractEvidence[]): void {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ln = i + 1;

      const routeMatch = line.match(/@(Get|Post|Put|Delete|Patch|All)\(\s*['"]([^'"]+)['"]\s*\)/);
      if (routeMatch) {
        acc.push({ type: 'api-route', file, line: ln, method: routeMatch[1], path: routeMatch[2] });
        continue;
      }

      const expressRoute = line.match(/\.(get|post|put|delete|patch|use)\(\s*['"]([^'"]+)['"]/);
      if (expressRoute) {
        acc.push({
          type: 'api-route', file, line: ln,
          method: expressRoute[1].toUpperCase(),
          path: expressRoute[2]
        });
        continue;
      }

      const eventEmit = line.match(/(?:emit|trigger|publish|send)\(\s*['"]([^'"]+)['"]/);
      if (eventEmit) {
        acc.push({ type: 'event', file, line: ln, eventName: eventEmit[1] });
        continue;
      }

      const webhookMatch = line.match(/webhook|callback.*url/i);
      if (webhookMatch) {
        acc.push({ type: 'webhook', file, line: ln });
      }
    }
  }

  async buildDataAccess(files: FileEvidence[]): Promise<DataAccessEvidence[]> {
    const access: DataAccessEvidence[] = [];
    for (const f of files) {
      try {
        const content = fs.readFileSync(f.path, 'utf-8');
        this.extractDataAccess(f.path, content, access);
      } catch { /* skip */ }
    }
    return access;
  }

  private extractDataAccess(file: string, content: string, acc: DataAccessEvidence[]): void {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ln = i + 1;

      const queryMatch = line.match(/(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/i);
      if (queryMatch) {
        acc.push({ file, line: ln, kind: this.sqlKind(queryMatch[0].trim()), target: 'database', raw: true });
        continue;
      }

      const ormWrite = line.match(/\.(create|update|delete|save|remove|upsert|insert)\s*\(/);
      if (ormWrite) {
        acc.push({ file, line: ln, kind: 'write', target: 'orm', orm: 'unknown' });
        continue;
      }

      const ormRead = line.match(/\.(findMany|findFirst|findUnique|findOne|findAll|findById|query|select)\s*\(/);
      if (ormRead) {
        acc.push({ file, line: ln, kind: 'read', target: 'orm', orm: 'unknown' });
      }
    }
  }

  private sqlKind(keyword: string): DataAccessEvidence['kind'] {
    const k = keyword.toUpperCase();
    if (k === 'SELECT') return 'read';
    if (k === 'INSERT' || k === 'UPDATE') return 'write';
    if (k === 'DELETE') return 'delete';
    if (k === 'CREATE' || k === 'DROP' || k === 'ALTER') return 'migrate';
    return 'read';
  }

  async buildTests(files: FileEvidence[]): Promise<TestEvidence[]> {
    const tests: TestEvidence[] = [];
    for (const f of files) {
      if (!this.isTestFile(f.path)) continue;
      try {
        const content = fs.readFileSync(f.path, 'utf-8');
        this.extractTests(f.path, content, tests);
      } catch { /* skip */ }
    }
    return tests;
  }

  private isTestFile(filePath: string): boolean {
    return /\.(test|spec|__tests__)\.(ts|tsx|js|jsx)$/.test(filePath)
      || filePath.includes('__tests__');
  }

  private extractTests(file: string, content: string, acc: TestEvidence[]): void {
    const lines = content.split('\n');
    let currentDescribe = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ln = i + 1;

      const describeMatch = line.match(/describe\(\s*['"`]([^'"]+)['"`]/);
      if (describeMatch) {
        currentDescribe = describeMatch[1];
        continue;
      }

      const itMatch = line.match(/(?:it|test)\(\s*['"`]([^'"]+)['"`]/);
      if (itMatch) {
        const kind = this.inferTestKind(file, currentDescribe);
        acc.push({
          file,
          describeBlock: currentDescribe || undefined,
          testName: itMatch[1],
          line: ln,
          kind
        });
      }
    }
  }

  private inferTestKind(file: string, describe: string): TestEvidence['kind'] {
    const combined = (file + ' ' + describe).toLowerCase();
    if (combined.includes('e2e') || combined.includes('end-to-end')) return 'e2e';
    if (combined.includes('integration')) return 'integration';
    if (combined.includes('property') || combined.includes('quickcheck')) return 'property';
    if (combined.includes('contract')) return 'contract';
    return 'unit';
  }

  async buildConfigs(root: string): Promise<ConfigEvidence[]> {
    const configs: ConfigEvidence[] = [];
    const configFiles = [
      { pattern: 'package.json', kind: 'package' as const },
      { pattern: 'tsconfig.json', kind: 'tsconfig' as const },
      { pattern: '.eslintrc*', kind: 'eslint' as const },
      { pattern: 'eslint.config.*', kind: 'eslint' as const },
      { pattern: 'docker-compose*.yml', kind: 'docker' as const },
      { pattern: 'Dockerfile*', kind: 'docker' as const },
      { pattern: '.github/workflows/*.yml', kind: 'ci' as const },
      { pattern: '*.tf', kind: 'terraform' as const },
    ];

    for (const { pattern, kind } of configFiles) {
      const found = this.globPattern(root, pattern);
      for (const f of found) {
        configs.push({ file: f, kind });
      }
    }

    const envFiles = ['.env', '.env.local', '.env.example', '.env.production'];
    for (const ef of envFiles) {
      const full = path.join(root, ef);
      if (fs.existsSync(full)) {
        configs.push({ file: ef, kind: 'env' });
      }
    }

    return configs;
  }

  private globPattern(root: string, pattern: string): string[] {
    if (pattern.includes('*')) {
      const parts = pattern.split('/');
      return this.globParts(root, parts);
    }
    const full = path.join(root, pattern);
    return fs.existsSync(full) ? [pattern] : [];
  }

  private globParts(root: string, parts: string[]): string[] {
    if (parts.length === 0) return [''];
    const [head, ...rest] = parts;
    if (!head) return this.globParts(root, rest);
    if (head.includes('*')) {
      try {
        const entries = fs.readdirSync(root);
        const matches = entries.filter(e => this.globMatch(e, head));
        const results: string[] = [];
        for (const m of matches) {
          const sub = path.join(root, m);
          if (rest.length === 0) {
            results.push(m);
          } else if (fs.statSync(sub).isDirectory()) {
            const subResults = this.globParts(sub, rest);
            for (const s of subResults) results.push(path.join(m, s).replace(/\\/g, '/'));
          }
        }
        return results;
      } catch { return []; }
    }
    const sub = path.join(root, head);
    if (fs.existsSync(sub)) {
      if (rest.length === 0) return [head];
      if (fs.statSync(sub).isDirectory()) {
        return this.globParts(sub, rest).map(s => path.join(head, s).replace(/\\/g, '/'));
      }
    }
    return [];
  }

  private globMatch(name: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    return regex.test(name);
  }

  async buildSecurity(files: FileEvidence[]): Promise<SecurityEvidence[]> {
    const findings: SecurityEvidence[] = [];
    const secretPatterns = [
      { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{8,}['"]/i, kind: 'secret' as const, desc: 'Hardcoded API key' },
      { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/i, kind: 'credential' as const, desc: 'Hardcoded password' },
      { pattern: /(?:secret|token)\s*[:=]\s*['"][A-Za-z0-9+/=_-]{16,}['"]/i, kind: 'secret' as const, desc: 'Hardcoded secret/token' },
      { pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/, kind: 'credential' as const, desc: 'Private key in source' },
      { pattern: /(?:sk|pk)[_-](?:live|test|api)[_-][A-Za-z0-9]{16,}/, kind: 'secret' as const, desc: 'Stripe/payment key' },
    ];

    for (const f of files) {
      try {
        const content = fs.readFileSync(f.path, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          for (const { pattern, kind, desc } of secretPatterns) {
            if (pattern.test(lines[i])) {
              findings.push({
                file: f.path,
                line: i + 1,
                kind,
                severity: kind === 'credential' ? 'critical' : 'high',
                pattern: pattern.source,
                description: desc
              });
            }
          }
        }
      } catch { /* skip */ }
    }
    return findings;
  }

  async buildOwnership(root: string, files: FileEvidence[]): Promise<OwnershipEvidence[]> {
    const byFile = new Map<string, OwnershipEvidence>();
    for (const f of files) {
      byFile.set(f.path, { file: f.path });
    }
    try {
      const { execSync } = require('child_process');
      for (const f of files) {
        try {
          const blame = execSync(`git blame --porcelain "${f.path}"`, {
            cwd: root, encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe']
          });
          const entry = byFile.get(f.path);
          if (entry) {
            const authors = new Map<string, number>();
            for (const line of blame.split('\n')) {
              const authorMatch = line.match(/^author\s+(.+)/);
              if (authorMatch) {
                const a = authorMatch[1];
                authors.set(a, (authors.get(a) ?? 0) + 1);
              }
            }
            let topAuthor = '';
            let topCount = 0;
            for (const [a, c] of authors) {
              if (c > topCount) { topAuthor = a; topCount = c; }
            }
            entry.lastAuthor = topAuthor;
          }
        } catch { /* skip */ }
      }
    } catch { /* git not available */ }
    return Array.from(byFile.values());
  }

  async buildInfrastructure(root: string): Promise<InfrastructureEvidence[]> {
    const infra: InfrastructureEvidence[] = [];
    const patterns = [
      { file: 'docker-compose.yml', kind: 'docker' as const },
      { file: 'docker-compose.yaml', kind: 'docker' as const },
      { file: 'Dockerfile', kind: 'docker' as const },
      { file: 'vercel.json', kind: 'ci' as const },
      { file: 'netlify.toml', kind: 'ci' as const },
    ];
    for (const { file, kind } of patterns) {
      const full = path.join(root, file);
      if (fs.existsSync(full)) {
        infra.push({ file, kind, service: file });
      }
    }
    const ciDir = path.join(root, '.github', 'workflows');
    if (fs.existsSync(ciDir)) {
      try {
        const workflows = fs.readdirSync(ciDir);
        for (const w of workflows) {
          infra.push({ file: `.github/workflows/${w}`, kind: 'ci', service: w });
        }
      } catch { /* skip */ }
    }
    return infra;
  }
}
