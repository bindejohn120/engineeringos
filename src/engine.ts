import * as fsp from 'fs/promises';
import * as path from 'path';
import type {
  Blueprint,
  BlueprintOptions,
  Component,
  ContextPackage,
  Guardrail,
  ImpactReport,
  Map,
  MentalModel,
  ScannedFile,
  Guardrails
} from './core/types';
import { FileExportAdapter, type AgentContext, type AgentState } from './agents/adapter';
import { EngineeringOSRepository } from './storage/repository';
import { scanWorkspace, buildImportRecords } from './analyzer/source';
import { readPackageDependencyList } from './analyzer/dependencies';
import { getCurrentCommit, getGitState, type GitState } from './analyzer/git';
import { runGuardrailEngine, type GuardrailEngineResult } from './guardrails/engine';
import { detectDrift } from './drift/engine';
import { runVerification } from './verification/engine';
import { buildContextPackage, summarizeContext } from './context/engine';
import { computeImpact } from './impact/engine';
import { renderBlueprintMd, renderGuardrailsMd, renderMapMd, renderMentalModelMd } from './markdown/generator';
import { estimateTokens, slugify } from './core/knowledge';
import { createMap, addComponent, addWorkflow, addRelationship } from './map/engine';
import { createMentalModel, addInvariant, addUnknown, addRisk, addAssumption, addStateMachine, addCausalRelationship, setCurrentState } from './mental-model/engine';
import { buildBlueprint, type BlueprintSeedInput } from './blueprint/engine';
import { createAIClient } from './ai/provider';
import { aiEnhanceBlueprint } from './ai/blueprint';
import { runAIPipeline } from './ai/pipeline';
import { generateContextualGuardrails } from './guardrails/generator';
import { evaluateOverallQuality, type ArtifactQualityScore } from './quality/engine';
import { buildAskSystem, buildAskUser } from './ai/qa';

export interface OnboardingInput {
  projectName: string;
  projectId: string;
  purpose: string;
  primaryUsers: string[];
  criticalCapabilities: string[];
  guardrailSeed?: boolean;
  architectureStyle?: string;
  securityLevel?: 'baseline' | 'hardened' | 'regulated';
  language?: string;
  runtime?: string;
  framework?: string;
  database?: string;
  blueprintText?: string;
  useAI?: boolean;
  entities?: string[];
  valueObjects?: string[];
  boundedContexts?: string[];
  domainEvents?: string[];
  authProvider?: string;
  paymentProviders?: string[];
  notificationProviders?: string[];
  storageProviders?: string[];
  otherIntegrations?: string[];
  integrationContracts?: string;
  targetLatency?: string;
  targetConcurrency?: string;
  targetUptime?: string;
  availability?: string;
  threatLevel?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  compliance?: string[];
  dataRetention?: string;
  slaRequirements?: string;
}

export interface WorkspaceAnalysis {
  files: ScannedFile[];
  filePaths: string[];
  git: GitState;
  commit: string | null;
}

export interface AnalysisResult {
  guardrails: GuardrailEngineResult;
  drift: ReturnType<typeof detectDrift>;
  verification: ReturnType<typeof runVerification>;
}

export interface OnboardingResult {
  map: Map;
  mentalModel: MentalModel;
  guardrails: Guardrails;
  blueprint: Blueprint;
  blueprintNote?: string;
  aiEnhanced?: boolean;
  domainEntities?: string[];
  threats?: number;
  notes?: string[];
  quality?: ArtifactQualityScore;
}

export class EngineeringOSEngine {
  readonly repository: EngineeringOSRepository;
  private readonly exportAdapter = new FileExportAdapter();
  secretApiKey?: string;

  constructor(readonly workspacePath: string) {
    this.repository = new EngineeringOSRepository(workspacePath);
  }

  async ensureLayout(): Promise<void> {
    await this.repository.ensureLayout();
  }

  async isInitialized(): Promise<boolean> {
    return this.repository.isInitialized();
  }

  async analyzeWorkspace(): Promise<WorkspaceAnalysis> {
    const files = await scanWorkspace(this.workspacePath, { include: ['**/*'] });
    const filePaths = files.map((f) => f.relativePath);
    const git = await getGitState(this.workspacePath);
    const commit = await getCurrentCommit(this.workspacePath);
    return { files, filePaths, git, commit };
  }

  async buildOnboardingModel(
    input: OnboardingInput,
    onProgress?: (phase: string, progress: number) => void
  ): Promise<OnboardingResult> {
    // Run workspace analysis to auto-detect tech stack when user hasn't provided it.
    let analysis: WorkspaceAnalysis | undefined;
    try {
      analysis = await this.analyzeWorkspace();
    } catch {
      // Workspace analysis is best-effort; proceed without it.
    }

    // Auto-detect tech stack from workspace files if not provided by user.
    const enriched = { ...input };
    if (analysis) {
      const files = analysis.filePaths;
      if (!enriched.language) {
        if (files.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'))) enriched.language = 'TypeScript';
        else if (files.some((f) => f.endsWith('.py'))) enriched.language = 'Python';
        else if (files.some((f) => f.endsWith('.go'))) enriched.language = 'Go';
        else if (files.some((f) => f.endsWith('.java'))) enriched.language = 'Java';
        else if (files.some((f) => f.endsWith('.cs'))) enriched.language = 'C#';
      }
      if (!enriched.runtime) {
        if (files.some((f) => f === 'package.json')) enriched.runtime = 'Node.js';
        else if (files.some((f) => f === 'requirements.txt' || f === 'pyproject.toml')) enriched.runtime = 'Python';
        else if (files.some((f) => f === 'go.mod')) enriched.runtime = 'Go';
      }
      if (!enriched.framework) {
        if (files.some((f) => f.includes('nest-cli.json') || f.includes('nest'))) enriched.framework = 'NestJS';
        else if (files.some((f) => f.includes('next.config'))) enriched.framework = 'Next.js';
        else if (files.some((f) => f.includes('angular.json'))) enriched.framework = 'Angular';
        else if (files.some((f) => f.includes('vue.config') || f.includes('vite.config'))) enriched.framework = 'Vue';
        else if (files.some((f) => f === 'package.json')) enriched.framework = 'Express';
      }
      if (!enriched.database) {
        if (files.some((f) => f.includes('prisma/schema'))) enriched.database = 'Prisma';
        else if (files.some((f) => f.includes('drizzle'))) enriched.database = 'Drizzle';
        else if (files.some((f) => f.includes('sequelize'))) enriched.database = 'Sequelize';
        else if (files.some((f) => f.includes('typeorm'))) enriched.database = 'TypeORM';
      }
      if (!enriched.architectureStyle) {
        enriched.architectureStyle = files.some((f) => f.includes('apps/') || f.includes('services/')) ? 'microservices' : 'layered';
      }
      // Detect existing guardrails from source files.
      if (enriched.guardrailSeed !== false) {
        const hasGuardrails = files.some((f) => f.includes('guardrail') || f.includes('invariant'));
        if (hasGuardrails) enriched.guardrailSeed = true;
      }
    }

    const map = createInitialMap(enriched);
    const mentalModel = createInitialMentalModel(enriched);
    const guardrails = enriched.guardrailSeed !== false ? seedGuardrails() : { schemaVersion: '1.0', modelVersion: 0, guardrails: [] as Guardrail[] };

    const envKeyName = 'ENGINEERINGOS_AI_KEY';
    const apiKey = process.env[envKeyName] || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
    const isOpenRouter = apiKey?.startsWith('sk-or-') ?? false;

    const config = {
      schemaVersion: '1.0',
      projectId: enriched.projectId,
      projectName: enriched.projectName,
      workspacePath: this.workspacePath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      analysis: { enabled: true, watchFiles: true, watchGit: true },
      ai: {
        provider: enriched.useAI === false ? 'none' : isOpenRouter ? 'openrouter' : 'openai',
        contextMode: 'minimal-relevant' as const,
        enabled: enriched.useAI !== false,
        model: isOpenRouter ? 'anthropic/claude-sonnet-4' : undefined as string | undefined,
        baseUrl: undefined as string | undefined,
        apiKeyEnv: undefined as string | undefined
      }
    };

    const blueprintInput: BlueprintSeedInput = {
      projectName: enriched.projectName,
      projectId: enriched.projectId,
      purpose: enriched.purpose,
      primaryUsers: enriched.primaryUsers,
      criticalCapabilities: enriched.criticalCapabilities,
      options: {
        architectureStyle: enriched.architectureStyle,
        securityLevel: enriched.securityLevel,
        language: enriched.language,
        runtime: enriched.runtime,
        framework: enriched.framework,
        database: enriched.database,
        sourceSpec: enriched.blueprintText
      }
    };

    let blueprint = buildBlueprint(blueprintInput);
    let blueprintNote: string | undefined;
    let aiEnhanced = false;
    let domainEntities: string[] = [];
    let threatCount = 0;
    const notes: string[] = [];

    if (analysis) {
      notes.push(`Workspace analysis: ${analysis.filePaths.length} files scanned, branch: ${analysis.git.branch ?? 'none'}.`);
    }

    if (enriched.useAI !== false) {
      const client = createAIClient(config, this.secretApiKey);
      if (client) {
        try {
          const pipelineResult = await runAIPipeline({
            client,
            map,
            mentalModel,
            guardrails,
            blueprint,
            projectName: input.projectName,
            purpose: input.purpose,
            primaryUsers: input.primaryUsers,
            criticalCapabilities: input.criticalCapabilities,
            architectureStyle: input.architectureStyle,
            language: input.language,
            framework: input.framework,
            database: input.database,
            compliance: input.compliance,
            targetLatency: input.targetLatency,
            targetConcurrency: input.targetConcurrency,
            securityLevel: input.securityLevel,
            onProgress
          });
          Object.assign(map, pipelineResult.map);
          Object.assign(mentalModel, pipelineResult.mentalModel);
          guardrails.guardrails = pipelineResult.guardrails.guardrails;
          blueprint = pipelineResult.blueprint;
          aiEnhanced = pipelineResult.aiEnhanced;
          domainEntities = pipelineResult.domainEntities;
          threatCount = pipelineResult.threats;
          notes.push(...pipelineResult.notes);
          if (pipelineResult.notes.some(n => n.includes('blueprint'))) {
            blueprintNote = `AI pipeline enhanced: ${pipelineResult.notes.join('; ')}`;
          }
        } catch (err) {
          notes.push(`Pipeline failed: ${err instanceof Error ? err.message : String(err)}`);
          const enhanced = await aiEnhanceBlueprint(client, blueprint, blueprintInput);
          blueprint = enhanced.blueprint;
          blueprintNote = enhanced.note;
        }
      } else {
        notes.push('AI client not configured; using deterministic output only.');
      }
    } else {
      notes.push('AI disabled; using deterministic output only.');
    }

    const contextualGuardrails = generateContextualGuardrails({
      frameworks: input.framework ? [input.framework.toLowerCase()] : [],
      databases: input.database ? [input.database.toLowerCase()] : [],
      domains: input.criticalCapabilities.map(c => c.toLowerCase()),
      compliance: input.compliance ?? [],
      existingGuardrails: guardrails.guardrails,
      maxGuardrails: 40
    });
    guardrails.guardrails.push(...contextualGuardrails);
    notes.push(`Added ${contextualGuardrails.length} contextual guardrails from templates.`);

    const quality = evaluateOverallQuality(map, mentalModel, guardrails, blueprint);

    const commit = await getCurrentCommit(this.workspacePath);
    await this.repository.saveConfig(config);
    await this.repository.saveMap(map, commit);
    await this.repository.saveMentalModel(mentalModel, commit);
    await this.repository.saveGuardrails(guardrails, commit);
    await this.repository.saveBlueprint(blueprint, commit);
    await this.regenerateMarkdown(map, mentalModel, guardrails, blueprint);
    return { map, mentalModel, guardrails, blueprint, blueprintNote, aiEnhanced, domainEntities, threats: threatCount, notes, quality };
  }

  async generateBlueprint(options?: BlueprintOptions): Promise<Blueprint> {
    const state = await this.loadStateOrThrow();
    const input = blueprintSeedFromState(state, options);
    let blueprint = buildBlueprint(input);
    let note: string | undefined;
    const config = await this.repository.loadConfig();
    if (config) {
      const client = createAIClient(config, this.secretApiKey);
      if (client) {
        const enhanced = await aiEnhanceBlueprint(client, blueprint, input);
        blueprint = enhanced.blueprint;
        note = enhanced.note;
      }
    }
    const commit = await getCurrentCommit(this.workspacePath);
    await this.repository.saveBlueprint(blueprint, commit);
    await this.repository.writeGenerated('blueprint.md', renderBlueprintMd(blueprint));
    return note ? blueprintWithNote(blueprint, note) : blueprint;
  }

  async aiStatus(): Promise<{ configured: boolean; kind: string | null }> {
    const config = await this.repository.loadConfig();
    if (!config) return { configured: false, kind: null };
    const client = createAIClient(config, this.secretApiKey);
    return { configured: Boolean(client?.isConfigured), kind: client?.kind ?? null };
  }

  async answerQuestion(question: string): Promise<{ answer: string; ai: boolean } | null> {
    const state = await this.loadStateOrThrow();
    const config = await this.repository.loadConfig();
    if (!config) return null;
    const client = createAIClient(config, this.secretApiKey);
    if (!client) return null;
    const impact = await computeImpact({
      target: question,
      map: state.map,
      mentalModel: state.mentalModel,
      guardrails: state.guardrails
    });
    const answer = await client.complete({
      system: buildAskSystem(state.map, state.mentalModel, state.guardrails),
      user: buildAskUser(question, impact),
      temperature: 0.2,
      maxTokens: 1024
    });
    return { answer, ai: true };
  }

  async regenerateMarkdown(map: Map, mentalModel: MentalModel, guardrails: Guardrails, blueprint?: Blueprint): Promise<void> {
    await this.repository.writeGenerated('map.md', renderMapMd(map));
    await this.repository.writeGenerated('mental-model.md', renderMentalModelMd(mentalModel));
    await this.repository.writeGenerated('guardrails.md', renderGuardrailsMd(guardrails));
    if (blueprint) {
      await this.repository.writeGenerated('blueprint.md', renderBlueprintMd(blueprint));
    }
  }

  async verifyChange(input?: {
    files?: ScannedFile[];
    filePaths?: string[];
  }): Promise<AnalysisResult> {
    const state = await this.loadStateOrThrow();
    const analysis = input ?? (await this.analyzeWorkspace());
    const files = analysis.files ?? [];
    const imports = await buildImportRecords(files);
    const dependencies = await readPackageDependencyList(this.workspacePath);

    const guardrailEngine = runGuardrailEngine({
      guardrails: state.guardrails.guardrails,
      files,
      imports,
      dependencies: dependencies.map((d) => d.name)
    });

    const drift = detectDrift({
      map: state.map,
      mentalModel: state.mentalModel,
      files: analysis.filePaths ?? files.map((f) => f.relativePath),
      guardrailResults: guardrailEngine.results
    });

    const verification = runVerification({
      map: state.map,
      mentalModel: state.mentalModel,
      guardrails: state.guardrails.guardrails,
      files: analysis.filePaths ?? files.map((f) => f.relativePath),
      guardrailEngine,
      drift
    });

    return { guardrails: guardrailEngine, drift, verification };
  }

  async prepareContext(task: string): Promise<{ package: ContextPackage; agent: AgentContext; summary: ReturnType<typeof summarizeContext>; serialized: string }> {
    const state = await this.loadStateOrThrow();
    const pkg = buildContextPackage({
      task,
      map: state.map,
      mentalModel: state.mentalModel,
      guardrails: state.guardrails
    });
    const agent = this.exportAdapter.prepareContext(pkg, state);
    const summary = summarizeContext(pkg);
    const serialized = this.exportAdapter.serializeContext(agent);
    await this.repository.writeContextPackage(
      'current-task.json',
      JSON.stringify(
        {
          ...pkg,
          serializedAgentContext: serialized,
          estimatedTokens: estimateTokens(serialized)
        },
        null,
        2
      )
    );
    return { package: pkg, agent, summary, serialized };
  }

  async predictImpact(target: string): Promise<ImpactReport> {
    const state = await this.loadStateOrThrow();
    return computeImpact({
      target,
      map: state.map,
      mentalModel: state.mentalModel,
      guardrails: state.guardrails
    });
  }

  async loadStateOrThrow(): Promise<AgentState> {
    const state = await this.repository.loadState();
    if (!state.map || !state.mentalModel || !state.guardrails || !state.config) {
      throw new Error('EngineeringOS is not initialized. Run "EngineeringOS: Initialize Engineering Model" first.');
    }
    return { map: state.map, mentalModel: state.mentalModel, guardrails: state.guardrails };
  }

  async loadState(): Promise<AgentState | null> {
    const state = await this.repository.loadState();
    if (!state.map || !state.mentalModel || !state.guardrails) return null;
    return { map: state.map, mentalModel: state.mentalModel, guardrails: state.guardrails };
  }

  async persistUpdates(map: Map, mentalModel: MentalModel, guardrails: Guardrails): Promise<void> {
    const commit = await getCurrentCommit(this.workspacePath);
    await this.repository.saveMap(map, commit);
    await this.repository.saveMentalModel(mentalModel, commit);
    await this.repository.saveGuardrails(guardrails, commit);
    await this.regenerateMarkdown(map, mentalModel, guardrails);
  }

  async writeAdr(filename: string, content: string): Promise<string> {
    await this.repository.ensureLayout();
    const target = path.join(this.repository.paths.decisions, filename);
    await fsp.writeFile(target, content, 'utf-8');
    return target;
  }

  async analyzeRepository(): Promise<{
    snapshot: import('./analyzer/types').RepositorySnapshot;
    graph: import('./analyzer/repository').ArchitectureGraph;
  }> {
    const { collectSnapshot, buildArchitectureGraph } = await import('./analyzer/repository');
    const snapshot = await collectSnapshot(this.workspacePath);
    const graph = buildArchitectureGraph(snapshot);
    return { snapshot, graph };
  }

  async runExecutableGuardrails(): Promise<{
    results: import('./core/protocol').CheckResult[];
    overall: import('./core/protocol').Verdict;
    violations: import('./core/protocol').Violation[];
  }> {
    const { evaluateAllRules } = await import('./guardrails/engine');
    const { collectSnapshot } = await import('./analyzer/repository');
    const state = await this.loadStateOrThrow();
    const snapshot = await collectSnapshot(this.workspacePath);

    const ctx: import('./guardrails/engine').RuleContext = {
      rootPath: this.workspacePath,
      files: snapshot.files.map(f => f.path),
      imports: snapshot.imports.map(i => ({ from: i.from, to: i.to, kind: i.kind, line: i.line })),
      symbols: snapshot.symbols.map(s => ({ file: s.file, name: s.name, kind: s.kind, line: s.line })),
      tests: snapshot.tests.map(t => ({ file: t.file, sourceFile: t.sourceFile, kind: t.kind })),
      security: snapshot.security.map(s => ({ file: s.file, line: s.line, kind: s.kind, severity: s.severity, description: s.description })),
      contracts: snapshot.contracts.map(c => ({ file: c.file, type: c.type, method: c.method, path: c.path })),
      dataAccess: snapshot.dataAccess.map(d => ({ file: d.file, line: d.line, kind: d.kind, target: d.target }))
    };

    const rules: import('./guardrails/engine').Rule[] = state.guardrails.guardrails.map(g => ({
      id: g.id,
      name: g.name,
      category: g.enforcement.includes('file-boundary') ? 'dependency' as const
        : g.enforcement.includes('pattern') ? 'secret' as const
        : 'structure' as const,
      scope: g.scope,
      severity: g.severity === 'blocking' ? 'BLOCKING' as const : g.severity === 'warning' ? 'WARNING' as const : 'INFO' as const,
      statement: g.rule,
      allowedPatterns: g.allowedPatterns,
      forbiddenPatterns: g.forbiddenPatterns,
      enforcement: g.enforcement,
      reason: g.reason,
      verification: g.verification,
      status: 'accepted' as const
    }));

    const results = evaluateAllRules(rules, ctx);
    const allViolations = results.flatMap(r => r.violations);
    const { worstVerdict } = await import('./core/protocol');
    const overall = worstVerdict(results.map(r => r.verdict));

    return { results, overall, violations: allViolations };
  }

  async computeHealthScore(): Promise<import('./health/scoring').HealthReport> {
    const { computeHealth } = await import('./health/scoring');
    const { collectSnapshot, buildArchitectureGraph } = await import('./analyzer/repository');
    const state = await this.loadStateOrThrow();
    const snapshot = await collectSnapshot(this.workspacePath);
    const graph = buildArchitectureGraph(snapshot);
    const execResult = await this.runExecutableGuardrails();

    const boundaryViolations = execResult.violations.filter(v => v.ruleId.includes('boundary') || v.ruleId.includes('GR-001')).length;
    const secretsFound = snapshot.security.filter(s => s.kind === 'secret' || s.kind === 'credential').length;
    const unownedModules = snapshot.ownership.filter(o => !o.lastAuthor).length;

    return computeHealth({
      components: state.map.components.length,
      boundaryViolations,
      dependencyCycles: 0,
      staleComponents: 0,
      invariantsTotal: state.mentalModel.invariants.length,
      invariantsProven: 0,
      invariantsPartiallyProven: 0,
      invariantsNotProven: state.mentalModel.invariants.length,
      testsTotal: snapshot.tests.length,
      testsLinkedToInvariants: 0,
      testEvidenceFreshness: 0,
      flakyTests: 0,
      driftFindings: 0,
      criticalDrift: 0,
      secretsFound,
      authCoverage: 1,
      dependencyVulnerabilities: 0,
      retryCoverage: 1,
      timeoutCoverage: 1,
      incidentFindings: 0,
      unownedModules,
      totalModules: graph.modules.length,
      unownedDecisions: 0,
      totalDecisions: state.mentalModel.decisions.length,
      maxFanOut: 0,
      cyclesDetected: 0,
      changeConcentration: 0
    });
  }
}

function blueprintSeedFromState(state: AgentState, options?: BlueprintOptions): BlueprintSeedInput {
  const { map, mentalModel } = state;
  return {
    projectName: map.project.name,
    projectId: map.project.id ?? 'project',
    purpose: map.project.purpose ?? mentalModel.systemUnderstanding.purpose ?? '',
    primaryUsers: mentalModel.systemUnderstanding.primaryUsers ?? [],
    criticalCapabilities: mentalModel.systemUnderstanding.criticalCapabilities ?? [],
    options
  };
}

function blueprintWithNote(blueprint: Blueprint, note: string): Blueprint {
  return { ...blueprint, summary: `${blueprint.summary}\n\n> ${note}` };
}

function createInitialMap(input: OnboardingInput): Map {
  let map = createMap(input.projectName, input.projectId);
  map.project.purpose = input.purpose;

  const capabilities = input.criticalCapabilities;
  const style = input.architectureStyle ?? 'layered';

  // Cross-cutting foundation components.
  const foundation: Component[] = [
    {
      id: 'api',
      name: 'API Gateway & Entry',
      purpose: `Exposes ${input.projectName} capabilities over a validated, versioned, authorized API.`,
      responsibilities: ['Validate and authorize every request', 'Shape responses and error envelopes', 'Route to application services'],
      inputs: ['inbound HTTP requests'],
      outputs: ['validated, authorized calls into application services'],
      dependencies: [],
      dependents: [],
      interfaces: ['REST endpoints'],
      failureModes: ['Input flood / rate exhaustion', 'Auth misconfiguration'],
      sourceLocations: []
    },
    {
      id: 'authn',
      name: 'Authentication & Authorization',
      purpose: 'Authenticates principals and authorizes every access decision with least privilege.',
      responsibilities: ['Issue and verify credentials', 'Enforce default-deny authorization', 'Provide principal context to services'],
      inputs: ['credentials / sessions / tokens'],
      outputs: ['authorized principal context'],
      dependencies: [],
      dependents: ['api'],
      interfaces: ['authenticate()', 'authorize(principal, action)'],
      failureModes: ['Auth bypass', 'Token leakage'],
      sourceLocations: []
    },
    {
      id: 'config',
      name: 'Configuration',
      purpose: 'Validates and provides environment-driven configuration at startup.',
      responsibilities: ['Load and validate configuration from environment', 'Reject missing or malformed required settings', 'Never expose secrets'],
      inputs: ['environment variables'],
      outputs: ['validated typed configuration'],
      dependencies: [],
      dependents: [],
      interfaces: ['get(section, key)'],
      failureModes: ['Misconfiguration at boot'],
      sourceLocations: []
    },
    {
      id: 'observability',
      name: 'Observability & Logging',
      purpose: 'Structured logging, metrics, and traces for every component.',
      responsibilities: ['Emit structured correlation-carrying logs', 'Publish metrics for critical flows', 'Support health and readiness checks'],
      inputs: ['structured events from components'],
      outputs: ['logs, metrics, traces, health endpoints'],
      dependencies: [],
      dependents: [],
      interfaces: ['log(event)', 'metric(name, value)', 'tracer'],
      failureModes: ['Log volume / cost spikes'],
      sourceLocations: []
    }
  ];
  for (const c of foundation) map = addComponent(map, c);

  // Per-capability application and data components.
  const appIds: string[] = [];
  capabilities.forEach((capability) => {
    const id = `app-${slugify(capability)}`;
    const title = toTitleCase(capability);
    appIds.push(id);
    map = addComponent(map, {
      id,
      name: `${title} Service`,
      purpose: `Implements the ${capability} capability of ${input.projectName}.`,
      responsibilities: [`Orchestrate ${capability} workflows`, 'Enforce business rules and invariants', `Publish ${capability} results to callers`],
      inputs: [`${title} requests`],
      outputs: [`${title} results and events`],
      dependencies: [],
      dependents: [],
      interfaces: [`handle${title.replace(/\s/g, '')}()`],
      failureModes: [`${title} business rule violation`, `${title} data inconsistency`],
      sourceLocations: []
    });

    const dataId = `data-${slugify(capability)}`;
    map = addComponent(map, {
      id: dataId,
      name: `${title} Repository`,
      purpose: `Owns persistence for ${capability} entities behind the ${title} service.`,
      responsibilities: [`Persist and query ${capability} entities`, 'Map domain objects to storage', 'Keep storage access out of business logic'],
      inputs: [`${title} entity commands`],
      outputs: [`${title} entity reads`],
      dependencies: [],
      dependents: [],
      interfaces: [`${slugify(capability)}Repository`],
      failureModes: ['Deadlocks / contention', 'Partial writes'],
      sourceLocations: []
    });

    map = addComponent(map, {
      id: `store-${slugify(capability)}`,
      name: `${title} Data Store`,
      purpose: `Persistent storage for ${capability} data.`,
      responsibilities: ['Store and index entity data', 'Enforce referential integrity'],
      inputs: [`${title} writes`],
      outputs: [`${title} reads`],
      dependencies: [],
      dependents: [],
      interfaces: ['SQL/query interface'],
      failureModes: ['Store outage', 'Capacity exhaustion'],
      sourceLocations: []
    });
    map.dataStores = [
      ...map.dataStores,
      {
        id: `store-${slugify(capability)}`,
        name: `${title} Data Store`,
        purpose: `Persistent storage for ${capability} data.`,
        tables: [`${slugify(capability)}_records`],
        dependencies: [],
        dependents: [],
        interfaces: ['SQL/query interface'],
        failureModes: ['Store outage', 'Capacity exhaustion'],
        sourceLocations: []
      }
    ];
  });

  // Domain entities from wizard input — these are core business concepts.
  const entityIds: string[] = [];
  if (input.entities && input.entities.length > 0) {
    for (const entity of input.entities) {
      const id = `entity-${slugify(entity)}`;
      entityIds.push(id);
      map = addComponent(map, {
        id,
        name: toTitleCase(entity),
        purpose: `Core domain entity representing ${entity} in ${input.projectName}.`,
        responsibilities: [`Encapsulate ${entity} business rules and invariants`, 'Maintain consistency of its own state', 'Expose domain operations'],
        inputs: [`Commands affecting ${entity}`],
        outputs: [`Queries and events for ${entity}`],
        dependencies: [],
        dependents: [],
        interfaces: [`${toTitleCase(entity).replace(/\s/g, '')}Entity`],
        failureModes: [`Invalid ${entity} state transition`, `Invariant violation on ${entity}`],
        sourceLocations: []
      });
    }
  }

  // Bounded contexts as grouping containers.
  const contextIds: string[] = [];
  if (input.boundedContexts && input.boundedContexts.length > 0) {
    for (const ctx of input.boundedContexts) {
      const id = `ctx-${slugify(ctx)}`;
      contextIds.push(id);
      map = addComponent(map, {
        id,
        name: `${toTitleCase(ctx)} Context`,
        purpose: `Bounded context grouping components within the ${ctx} domain.`,
        responsibilities: [`Enforce context-level invariants`, 'Manage context-specific workflows', 'Isolate domain logic from other contexts'],
        inputs: [`${toTitleCase(ctx)} requests`],
        outputs: [`${toTitleCase(ctx)} results`],
        dependencies: [],
        dependents: [],
        interfaces: [`${slugify(ctx)}Context`],
        failureModes: ['Context boundary violation', 'Cross-context inconsistency'],
        sourceLocations: []
      });
    }
  }

  // External systems derived from capabilities AND explicit integrations.
  const external: Component[] = [];
  if (capabilities.some((c) => /payment|billing|payout|pay/i.test(c)) || (input.paymentProviders && input.paymentProviders.length > 0)) {
    external.push({
      id: 'payment-gateway',
      name: 'Payment Gateway',
      purpose: `Authorizes and settles payments and payouts${input.paymentProviders && input.paymentProviders.length > 0 ? ` via ${describeList(input.paymentProviders)}` : ''}.`,
      responsibilities: ['Authorize charges', 'Settle payouts', 'Report webhook events'],
      inputs: ['payment intents'],
      outputs: ['authorization results', 'webhook events'],
      dependencies: [],
      dependents: [],
      interfaces: ['authorizePayment()', 'refundPayment()', 'webhook'],
      failureModes: ['Gateway outage', 'Webhook duplication', 'Charge failures'],
      sourceLocations: []
    });
  }
  if (capabilities.some((c) => /email|sms|notify|notification|message/i.test(c)) || (input.notificationProviders && input.notificationProviders.length > 0)) {
    external.push({
      id: 'notifier',
      name: 'Notification Provider',
      purpose: `Delivers transactional notifications${input.notificationProviders && input.notificationProviders.length > 0 ? ` via ${describeList(input.notificationProviders)}` : ''}.`,
      responsibilities: ['Send transactional messages', 'Track delivery state'],
      inputs: ['notification payloads'],
      outputs: ['delivery confirmations'],
      dependencies: [],
      dependents: [],
      interfaces: ['send()', 'deliveryStatus()'],
      failureModes: ['Provider outage', 'Undeliverable recipients'],
      sourceLocations: []
    });
  }
  if (input.authProvider && input.authProvider !== 'None') {
    external.push({
      id: 'auth-provider',
      name: `${input.authProvider} Integration`,
      purpose: `External authentication via ${input.authProvider}.`,
      responsibilities: ['Authenticate users', 'Issue/verify tokens', 'Provide user profile data'],
      inputs: ['login credentials', 'tokens'],
      outputs: ['authenticated session', 'user profile'],
      dependencies: [],
      dependents: ['authn'],
      interfaces: ['authenticate()', 'verifyToken()', 'refreshToken()'],
      failureModes: ['Provider outage', 'Token validation failure', 'Rate limiting'],
      sourceLocations: []
    });
  }
  if (input.storageProviders && input.storageProviders.length > 0) {
    external.push({
      id: 'storage',
      name: 'Object Storage',
      purpose: `Stores files and assets via ${describeList(input.storageProviders)}.`,
      responsibilities: ['Store and retrieve files', 'Manage access control', 'Handle lifecycle policies'],
      inputs: ['file uploads', 'file read requests'],
      outputs: ['file URLs', 'file content'],
      dependencies: [],
      dependents: [],
      interfaces: ['upload()', 'download()', 'delete()'],
      failureModes: ['Storage outage', 'Quota exceeded', 'Access denied'],
      sourceLocations: []
    });
  }
  if (input.otherIntegrations && input.otherIntegrations.length > 0) {
    for (const integration of input.otherIntegrations) {
      external.push({
        id: `ext-${slugify(integration)}`,
        name: integration,
        purpose: `External ${integration} integration.`,
        responsibilities: [`Interact with ${integration}`, 'Send and receive data'],
        inputs: [`Data from ${integration}`],
        outputs: [`Data to ${integration}`],
        dependencies: [],
        dependents: [],
        interfaces: [`${slugify(integration)}Client`],
        failureModes: [`${integration} unavailability`],
        sourceLocations: []
      });
    }
  }
  for (const e of external) map = addComponent(map, e);

  // Relationship wiring (dependency direction: api -> services -> data -> stores; api -> authn/config/observability).
  const addRel = (from: string, to: string, type: string, description: string): void => {
    map = addRelationship(map, {
      id: `rel-${from}-${to}`,
      from,
      to,
      type,
      description
    });
    const fromC = map.components.find((c) => c.id === from);
    const toC = map.components.find((c) => c.id === to);
    if (fromC && !fromC.dependencies.includes(to)) fromC.dependencies.push(to);
    if (toC && !toC.dependents.includes(from)) toC.dependents.push(from);
  };

  addRel('api', 'authn', 'uses', 'Entry layer authenticates and authorizes requests.');
  addRel('api', 'config', 'uses', 'Entry layer reads validated configuration.');
  addRel('api', 'observability', 'uses', 'Entry layer emits structured logs and metrics.');

  capabilities.forEach((capability) => {
    const id = `app-${slugify(capability)}`;
    const dataId = `data-${slugify(capability)}`;
    const storeId = `store-${slugify(capability)}`;
    addRel('api', id, 'invokes', `Entry layer delegates ${capability} work to the application service.`);
    addRel(id, dataId, 'persists-through', `${capability} service owns data through its repository.`);
    addRel(dataId, storeId, 'writes', `Repository persists ${capability} data to its store.`);
    addRel(id, 'observability', 'emits-to', `${capability} service emits logs and metrics.`);
  });

  for (const e of external) {
    addRel(`app-${slugify(e.id === 'notifier' ? 'notify' : e.id)}`, e.id, 'calls', `Application services call the ${e.name}.`);
  }

  // Workflows.
  const primarySteps = capabilities.length > 0 ? capabilities : ['primary capability'];
  map = addWorkflow(map, {
    id: 'wf-primary',
    name: 'Primary User Journey',
    description: `Core journey through ${describeList(capabilities)}.`,
    steps: primarySteps,
    components: ['api', ...appIds],
    inputs: ['user intent'],
    outputs: [capabilities[capabilities.length - 1] ?? 'outcome']
  });
  if (input.primaryUsers.length > 0) {
    map = addWorkflow(map, {
      id: 'wf-auth',
      name: 'Authentication',
      description: 'A principal authenticates and is authorized for the requested action.',
      steps: ['Present credentials', 'Verify credentials', 'Issue principal context', 'Authorize requested action'],
      components: ['api', 'authn'],
      inputs: ['credentials'],
      outputs: ['authorized principal context']
    });
  }

  // Requirements.
  let reqCounter = 1;
  const requirements: Map['requirements'] = [];
  const addReq = (text: string, priority: 'critical' | 'high' | 'medium' | 'low', affected: string[]): void => {
    requirements.push({
      schemaVersion: '1.0',
      modelVersion: 0,
      id: `REQ-${String(reqCounter++).padStart(3, '0')}`,
      text,
      source: 'inferred',
      priority,
      status: 'open',
      evidence: [],
      affectedComponents: affected
    });
  };
  capabilities.forEach((capability) => {
    addReq(`The system MUST support ${capability} end to end.`, 'critical', [`app-${slugify(capability)}`]);
  });
  addReq('Every request MUST be authenticated and authorized before reaching business logic.', 'critical', ['api', 'authn']);
  addReq('State-changing operations MUST be idempotent or safe to retry.', 'critical', appIds);
  addReq('No secrets or credentials MAY be committed to the repository.', 'critical', ['config']);
  addReq('All components MUST emit structured, correlation-carrying logs.', 'high', ['observability', ...appIds]);
  addReq('Every invariant and critical workflow MUST be covered by automated tests.', 'high', appIds);

  // NFR requirements from wizard input.
  if (input.targetLatency) {
    addReq(`System MUST respond to requests within ${input.targetLatency} under normal load.`, 'high', appIds);
  }
  if (input.targetConcurrency) {
    addReq(`System MUST handle ${input.targetConcurrency} concurrent users without degradation.`, 'high', ['api', ...appIds]);
  }
  if (input.compliance && input.compliance.length > 0) {
    for (const standard of input.compliance) {
      addReq(`System MUST comply with ${standard} requirements.`, 'critical', [...appIds, 'authn']);
    }
  }
  if (input.availability) {
    addReq(`System MUST maintain ${input.availability} availability.`, 'critical', ['api', 'observability']);
  }
  if (input.dataRetention) {
    addReq(`Data retention policy: ${input.dataRetention}.`, 'high', [...appIds, 'config']);
  }
  if (input.threatLevel && input.threatLevel !== 'none') {
    addReq(`System MUST implement ${input.threatLevel}-level threat mitigations.`, 'high', ['authn', ...appIds]);
  }
  map.requirements = requirements;

  // Actors.
  map.actors = input.primaryUsers.map((user, index) => ({
    id: `actor-${slugify(user) || `user-${index}`}`,
    name: user,
    description: `${toTitleCase(user)} using ${input.projectName}.`,
    interactions: capabilities
  }));

  // Data flow.
  map.dataFlows = [{
    id: 'df-primary',
    name: 'Primary Request Flow',
    description: `A ${input.primaryUsers[0] || 'user'} request travels through the ${style} layers.`,
    steps: capabilities.length > 0
      ? [
          { step: 'Request received', from: 'api', to: 'authn', data: 'request + credentials' },
          ...capabilities.map((capability, index) => ({
            step: index === 0 ? 'Capability executed' : 'Next capability executed',
            from: 'api',
            to: `app-${slugify(capability)}`,
            data: capability
          })),
          { step: 'Response returned', from: 'api', to: undefined, data: 'result envelope' }
        ]
      : []
  }];

  // Environments + infrastructure.
  map.environments = [
    { id: 'dev', name: 'Development', description: 'Local iteration with isolated data.', properties: ['debug logging enabled'] },
    { id: 'staging', name: 'Staging', description: 'Pre-production parity environment.', properties: ['production-like data', 'all CI gates run'] },
    { id: 'prod', name: 'Production', description: 'Customer-facing environment.', properties: ['least privilege', 'audit logging', 'alerting'] }
  ];
  map.infrastructure = [
    { id: 'infra-app', name: 'Application Hosting', description: 'Runs the deployable artifact.', details: ['immutable deploys', 'health checks', 'horizontal scaling'] },
    { id: 'infra-db', name: 'Database Hosting', description: 'Hosts capability data stores.', details: ['backups', 'encryption at rest', 'connection limits'] },
    { id: 'infra-cicd', name: 'CI/CD', description: 'Build, test, and deploy pipeline.', details: ['lint', 'typecheck', 'tests', 'EngineeringOS verification'] }
  ];

  return map;
}

function createInitialMentalModel(input: OnboardingInput): MentalModel {
  const appIds = input.criticalCapabilities.map((c) => `app-${slugify(c)}`);

  let model = createMentalModel(input.purpose);
  model.systemUnderstanding.primaryUsers = input.primaryUsers;
  model.systemUnderstanding.criticalCapabilities = input.criticalCapabilities;
  model.systemUnderstanding.businessObjective = `Deliver ${describeList(input.criticalCapabilities)} for ${input.projectName}.`;
  model.systemUnderstanding.primaryWorkflows = input.primaryUsers.length > 0
    ? ['Primary User Journey', 'Authentication']
    : ['Primary User Journey'];
  model.systemUnderstanding.mostImportantConstraints = [
    'Dependency rule: entry → application → domain → repository → infrastructure.',
    'No secrets in code; configuration from validated environment.',
    'Idempotency for all state-changing operations.',
    'Tests required for every invariant and critical workflow.'
  ];

  model = setCurrentState(model, 'Initial model generated from onboarding; no code verified yet.', 'DRAFT');
  model.intendedState = {
    summary: `Production-grade ${input.projectName} with verified invariants, automated tests, and a green EngineeringOS verification.`,
    modelStage: 'STEADY'
  };

  // Entities + relationships.
  const entities: MentalModel['entities'] = input.criticalCapabilities.map((capability) => ({
    id: `entity-${slugify(capability)}`,
    name: toTitleCase(capability),
    description: `Concept owned by the ${capability} capability.`,
    kind: 'domain-concept',
    source: 'inference',
    confidence: 0.7
  }));
  if (input.primaryUsers.length > 0) {
    entities.push({
      id: 'entity-user',
      name: 'User',
      description: `A principal interacting with ${input.projectName}.`,
      kind: 'actor',
      source: 'inference',
      confidence: 0.8
    });
  }
  model.entities = entities;

  const mentalRelationships: MentalModel['relationships'] = input.criticalCapabilities.flatMap((capability) => {
    const entityId = `entity-${slugify(capability)}`;
    const out: MentalModel['relationships'] = [];
    if (input.primaryUsers.length > 0) {
      out.push({
        id: `mrel-user-${slugify(capability)}`,
        from: 'entity-user',
        to: entityId,
        type: 'engages-with',
        description: `Users engage the ${capability} capability.`
      });
    }
    if (capabilitiesPair(input.criticalCapabilities, capability)) {
      out.push({
        id: `mrel-${slugify(capability)}-next`,
        from: entityId,
        to: `entity-${slugify(nextCapability(input.criticalCapabilities, capability))}`,
        type: 'flows-into',
        description: `${capability} output feeds the next capability in the journey.`
      });
    }
    return out;
  });
  model.relationships = mentalRelationships;

  // Business rules.
  const businessRules: MentalModel['businessRules'] = input.criticalCapabilities.map((capability) => ({
    id: `BR-${slugify(capability).toUpperCase()}`,
    statement: `${capability} must behave predictably: same input, same output, safe under retry and concurrency.`,
    severity: /payment|billing|order|payout|transfer/i.test(capability) ? 'blocking' : 'warning',
    source: 'inference',
    confidence: 0.7
  }));
  businessRules.push(
    { id: 'BR-AUTH', statement: 'No capability may be reached without authentication and authorization.', severity: 'blocking', source: 'inference', confidence: 0.9 },
    { id: 'BR-IDEMPOTENT', statement: 'Repeating any state-changing operation must produce the same result as the first attempt.', severity: 'blocking', source: 'inference', confidence: 0.9 }
  );
  model.businessRules = businessRules;

  // Invariants.
  model = addInvariant(model, {
    id: 'INV-001',
    statement: 'Only authorized principals may read or mutate protected data.',
    severity: 'blocking',
    scope: ['api', 'authn'],
    enforcement: ['authorization guardrail', 'default-deny endpoints'],
    verification: ['authorization guardrail validation', 'negative-path tests']
  });
  model = addInvariant(model, {
    id: 'INV-002',
    statement: 'State-changing operations are idempotent: retries never duplicate effects.',
    severity: 'blocking',
    scope: ['api', ...input.criticalCapabilities.map((c) => `app-${slugify(c)}`)],
    enforcement: ['idempotency keys on mutation endpoints'],
    verification: ['retry tests', 'idempotency contract tests']
  });
  model = addInvariant(model, {
    id: 'INV-003',
    statement: 'Multi-step writes are atomic: no partial state is observable.',
    severity: 'blocking',
    scope: input.criticalCapabilities.map((c) => `data-${slugify(c)}`),
    enforcement: ['transactions', 'write-through repositories'],
    verification: ['rollback tests', 'concurrency tests']
  });
  model = addInvariant(model, {
    id: 'INV-004',
    statement: 'Security-relevant actions are written to an audit trail.',
    severity: 'warning',
    scope: ['api', 'authn'],
    enforcement: ['audit logging on auth and mutation'],
    verification: ['audit trail tests']
  });
  model = addInvariant(model, {
    id: 'INV-005',
    statement: 'No secrets or credentials exist anywhere in the repository.',
    severity: 'blocking',
    scope: ['config'],
    enforcement: ['secret-scan guardrail'],
    verification: ['guardrail validation', 'secret scan']
  });
  model = addInvariant(model, {
    id: 'INV-006',
    statement: 'The engineering model and the codebase never diverge without recorded evidence.',
    severity: 'advisory',
    scope: [],
    enforcement: ['EngineeringOS drift detection'],
    verification: ['engineeringos.verify']
  });

  // Domain-specific invariants from wizard input.
  let invCounter = 7;
  if (input.entities && input.entities.length > 0) {
    for (const entity of input.entities) {
      const id = `INV-${String(invCounter++).padStart(3, '0')}`;
      model = addInvariant(model, {
        id,
        statement: `${toTitleCase(entity)} entities are always in a valid state; invalid transitions are rejected.`,
        severity: 'blocking',
        scope: [`entity-${slugify(entity)}`],
        enforcement: [`${entity} state validation`, 'invariant checks on mutation'],
        verification: [`state transition tests for ${entity}`]
      });
    }
  }
  if (input.targetLatency) {
    model = addInvariant(model, {
      id: `INV-${String(invCounter++).padStart(3, '0')}`,
      statement: `Response latency must not exceed ${input.targetLatency} at the 95th percentile under expected load.`,
      severity: 'warning',
      scope: ['api', ...appIds],
      enforcement: ['latency budgets', 'timeout guardrails'],
      verification: ['load tests', 'latency monitoring']
    });
  }
  if (input.targetConcurrency) {
    model = addInvariant(model, {
      id: `INV-${String(invCounter++).padStart(3, '0')}`,
      statement: `System must handle ${input.targetConcurrency} concurrent users without data corruption or errors.`,
      severity: 'blocking',
      scope: ['api', ...appIds],
      enforcement: ['connection pooling', 'concurrency limits'],
      verification: ['concurrent access tests']
    });
  }
  if (input.compliance && input.compliance.length > 0) {
    for (const standard of input.compliance) {
      model = addInvariant(model, {
        id: `INV-${String(invCounter++).padStart(3, '0')}`,
        statement: `System must comply with ${standard} requirements for all relevant data and operations.`,
        severity: 'blocking',
        scope: [...appIds, 'authn'],
        enforcement: [`${standard} guardrails`, 'compliance checks'],
        verification: [`${standard} compliance validation`]
      });
    }
  }

  // State machine (order lifecycle when ordering present).
  if (input.criticalCapabilities.some((c) => /order|ordering|checkout|booking/i.test(c))) {
    model = addStateMachine(model, {
      entity: 'Order',
      states: ['draft', 'placed', 'confirmed', 'paid', 'fulfilled', 'cancelled'],
      transitions: [
        { from: 'draft', to: 'placed', trigger: 'submit' },
        { from: 'placed', to: 'confirmed', trigger: 'validate' },
        { from: 'confirmed', to: 'paid', trigger: 'paymentSuccess' },
        { from: 'paid', to: 'fulfilled', trigger: 'fulfill' },
        { from: 'placed', to: 'cancelled', trigger: 'cancel' },
        { from: 'confirmed', to: 'cancelled', trigger: 'cancel' }
      ],
      invalidTransitions: ['paid -> placed', 'fulfilled -> cancelled', 'cancelled -> confirmed']
    });
  }

  // Causal relationships.
  model = addCausalRelationship(model, {
    id: 'CR-001',
    cause: 'Payment failure or timeout',
    effect: 'Order is cancelled or held, never partially paid',
    conditions: ['payment is in-flight', 'idempotency key present'],
    sideEffects: ['retryable failure logged', 'webhook deduplicated']
  });
  model = addCausalRelationship(model, {
    id: 'CR-002',
    cause: 'External provider outage',
    effect: 'Capability degrades gracefully with retries and circuit breaking',
    conditions: ['circuit breaker open'],
    sideEffects: ['degraded-mode responses', 'recovery probing']
  });

  // Architectural principles.
  model.architecturalPrinciples = [
    { id: 'PR-001', name: 'Dependency Rule', description: 'Dependencies point inward; entry code never reaches storage directly.' },
    { id: 'PR-002', name: 'Fail Fast', description: 'Validate at boundaries; surface errors immediately with context.' },
    { id: 'PR-003', name: 'Least Privilege', description: 'Every principal and process gets the minimum access required.' },
    { id: 'PR-004', name: 'Defense in Depth', description: 'Security is enforced at entry, service, and data layers simultaneously.' },
    { id: 'PR-005', name: 'Idempotent by Default', description: 'Side effects are safe to retry by construction.' },
    { id: 'PR-006', name: 'Observed over Assumed', description: 'Claims about the system require evidence from code, tests, or runtime.' },
    { id: 'PR-007', name: 'Keep It Minimal', description: 'No speculative abstraction, dependency, or code.' },
    { id: 'PR-008', name: 'Predictable Structure', description: 'Modules, names, and boundaries are consistent and discoverable.' }
  ];

  // Decisions.
  const now = new Date().toISOString();
  const architectureStyle = input.architectureStyle ?? 'layered';
  const decision = (id: string, title: string, decisionText: string, reason: string, alternatives: string[], consequences: string[], affected: string[]): MentalModel['decisions'][number] => ({
    id,
    title,
    context: `Initial architecture decision made while generating the ${input.projectName} engineering model.`,
    decision: decisionText,
    reason,
    alternatives,
    consequences,
    affectedComponents: affected,
    status: 'proposed',
    date: now,
    source: 'inference',
    confidence: 0.6,
    confidenceReason: 'Generated from onboarding input; revisit and accept as code is written.'
  });
  model.decisions = [
    decision(
      'DEC-001',
      'Architecture Style',
      `Adopt ${architectureStyle} architecture with enforced module boundaries.`,
      'Matches the project scale and the goal of a predictable, maintainable codebase.',
      ['monolithic', 'microservices', 'event-driven', 'clean-architecture'],
      ['Boundaries enforced by guardrails', 'Modules may be extracted to services later'],
      ['api', ...input.criticalCapabilities.map((c) => `app-${slugify(c)}`)]
    ),
    decision(
      'DEC-002',
      'Idempotency Strategy',
      'State-changing endpoints accept an idempotency key and return the stored result on retry.',
      'Makes retries and webhook replays safe, which is essential for payments and external systems.',
      ['at-most-once semantics', 'client-generated tokens'],
      ['Slightly larger request contract', 'Idempotency store per capability'],
      ['api', 'payment-gateway']
    ),
    decision(
      'DEC-003',
      'Error Handling',
      'Use explicit typed errors and fail-fast validation; no empty catches.',
      'Makes failures predictable and diagnosable across the system.',
      ['exceptions everywhere', 'silent fallbacks'],
      ['Callers choose recovery', 'Errors carry structured context'],
      ['api', ...input.criticalCapabilities.map((c) => `app-${slugify(c)}`)]
    ),
    decision(
      'DEC-004',
      'Observability',
      'Structured JSON logging via the observability module; console logging banned in production paths.',
      'Enables diagnosis without guesswork and keeps PII out of logs.',
      ['plain text logs', 'ad-hoc logging'],
      ['Structured logs are searchable', 'Logging goes through one module'],
      ['observability']
    ),
    decision(
      'DEC-005',
      'Configuration',
      'All configuration is validated at startup from the environment; secrets never enter the repository.',
      'Keeps secrets out of code and catches misconfiguration early.',
      ['config files committed', 'magic constants'],
      ['Environment must be complete to boot', 'Secret scan guardrail stays green'],
      ['config']
    )
  ];

  // Wizard-driven decisions.
  if (input.compliance && input.compliance.length > 0) {
    model.decisions.push(decision(
      'DEC-COMPLIANCE',
      'Compliance Posture',
      `System must satisfy ${describeList(input.compliance)} requirements for all relevant data flows and storage.`,
      `Mandatory compliance with ${describeList(input.compliance)} regulations.`,
      ['retrofit compliance later', 'ignore compliance'],
      ['Compliance guardrails enabled', 'Audit logging enforced', 'Data retention policies active'],
      [...appIds, 'authn', 'config']
    ));
  }
  if (input.availability) {
    model.decisions.push(decision(
      'DEC-AVAILABILITY',
      'Availability Target',
      `System targets ${input.availability} availability with health checks, circuit breakers, and failover.`,
      `Business requirement for ${input.availability} uptime.`,
      ['no availability target', 'best-effort availability'],
      ['Health checks required', 'Circuit breakers on external calls', 'Graceful degradation paths'],
      ['api', 'observability', ...appIds]
    ));
  }
  if (input.threatLevel && input.threatLevel !== 'none') {
    model.decisions.push(decision(
      'DEC-SECURITY',
      'Threat Mitigation Level',
      `System implements ${input.threatLevel}-level threat mitigations including input validation, auth hardening, and audit logging.`,
      `Threat model assessment indicates ${input.threatLevel} risk level.`,
      ['no threat mitigation', 'basic security only'],
      ['STRIDE threat model applied', 'Security guardrails enforced', 'Penetration testing required'],
      ['api', 'authn', ...appIds]
    ));
  }

  // Assumptions.
  model = addAssumption(model, {
    id: 'ASM-001',
    statement: `The listed primary users (${describeList(input.primaryUsers) || 'to be confirmed'}) accurately represent who uses the system.`,
    impact: 'high',
    source: 'assumption',
    confidence: 0.7,
    evidence: []
  });
  model = addAssumption(model, {
    id: 'ASM-002',
    statement: `The critical capabilities (${describeList(input.criticalCapabilities)}) define the complete initial scope.`,
    impact: 'high',
    source: 'assumption',
    confidence: 0.6,
    evidence: []
  });
  model = addAssumption(model, {
    id: 'ASM-003',
    statement: 'Build proceeds from the current workspace state; existing code must be reconciled with the model.',
    impact: 'medium',
    source: 'assumption',
    confidence: 0.8,
    evidence: []
  });
  model = addAssumption(model, {
    id: 'ASM-004',
    statement: input.architectureStyle === 'microservices'
      ? 'Each capability is independently deployable with its own data store.'
      : 'A single deployable artifact hosts all capabilities with separate modules.',
    impact: 'medium',
    source: 'assumption',
    confidence: 0.7,
    evidence: []
  });

  // Wizard-driven assumptions.
  if (input.targetLatency) {
    model = addAssumption(model, {
      id: 'ASM-LATENCY',
      statement: `Target latency of ${input.targetLatency} at p95 is achievable with the chosen architecture.`,
      impact: 'high',
      source: 'inference',
      confidence: 0.6,
      evidence: []
    });
  }
  if (input.targetConcurrency) {
    model = addAssumption(model, {
      id: 'ASM-CONCURRENCY',
      statement: `Expected peak concurrency of ${input.targetConcurrency} users can be handled with horizontal scaling.`,
      impact: 'high',
      source: 'inference',
      confidence: 0.6,
      evidence: []
    });
  }
  if (input.availability) {
    model = addAssumption(model, {
      id: 'ASM-AVAILABILITY',
      statement: `${input.availability} availability is achievable within the infrastructure budget and deployment model.`,
      impact: 'critical',
      source: 'inference',
      confidence: 0.5,
      evidence: []
    });
  }

  // Unknowns — resolved where wizard input provides answers.
  model = addUnknown(model, {
    id: 'UNK-001',
    question: 'What are the most critical business workflows and their exact failure modes?',
    impact: 'high',
    blocks: ['verification plan', 'invariant completeness'],
    status: input.criticalCapabilities.length > 0 ? 'partially-resolved' : 'unresolved',
    evidence: input.criticalCapabilities.length > 0 ? [{ type: 'developer-confirmation', location: 'onboarding', description: `Identified ${input.criticalCapabilities.length} critical capabilities from onboarding` }] : []
  });
  model = addUnknown(model, {
    id: 'UNK-002',
    question: 'What load and concurrency are expected at launch?',
    impact: 'high',
    blocks: ['performance and capacity planning'],
    status: input.targetConcurrency ? 'resolved' : 'unresolved',
    evidence: input.targetConcurrency ? [{ type: 'developer-confirmation', location: 'onboarding', description: `Target concurrency: ${input.targetConcurrency}` }] : []
  });
  model = addUnknown(model, {
    id: 'UNK-003',
    question: 'What compliance and regulatory requirements apply?',
    impact: 'medium',
    blocks: ['security level selection'],
    status: input.compliance && input.compliance.length > 0 ? 'resolved' : 'unresolved',
    evidence: input.compliance && input.compliance.length > 0 ? [{ type: 'developer-confirmation', location: 'onboarding', description: `Compliance: ${describeList(input.compliance)}` }] : []
  });
  model = addUnknown(model, {
    id: 'UNK-004',
    question: 'What are the exact contracts of external systems (payment, notification, auth providers)?',
    impact: 'medium',
    blocks: ['adapter implementations'],
    status: (input.paymentProviders && input.paymentProviders.length > 0) || (input.authProvider && input.authProvider !== 'None') ? 'partially-resolved' : 'unresolved',
    evidence: [
      ...(input.paymentProviders || []).map((p) => ({ type: 'developer-confirmation' as const, location: 'onboarding', description: `Payment provider: ${p}` })),
      ...(input.authProvider && input.authProvider !== 'None' ? [{ type: 'developer-confirmation' as const, location: 'onboarding', description: `Auth provider: ${input.authProvider}` }] : []),
      ...(input.notificationProviders || []).map((n) => ({ type: 'developer-confirmation' as const, location: 'onboarding', description: `Notification provider: ${n}` }))
    ]
  });
  model = addUnknown(model, {
    id: 'UNK-005',
    question: 'What is the release cadence and who operates the system?',
    impact: 'low',
    blocks: ['CI/CD and on-call design'],
    status: 'unresolved',
    evidence: []
  });

  // Constraints.
  model.constraints = [
    { id: 'CON-001', statement: 'All code is type-safe; no `any` at module boundaries.', scope: 'src/**' },
    { id: 'CON-002', statement: 'Secrets and credentials never appear in code or generated files.', scope: 'repository' },
    { id: 'CON-003', statement: 'Automated tests are mandatory for new behavior and every invariant.', scope: 'src/**' },
    { id: 'CON-004', statement: 'The dependency rule is enforced by guardrails; violations block merge.', scope: 'src/**' },
    { id: 'CON-005', statement: 'Public APIs stay backward compatible unless a new version is introduced.', scope: 'api' },
    { id: 'CON-006', statement: 'Every committed change passes lint, typecheck, tests, and EngineeringOS verification.', scope: 'CI' }
  ];

  // Risks.
  model = addRisk(model, {
    id: 'RISK-001',
    name: 'Architectural drift',
    description: 'Changes may violate the intended architecture over time.',
    likelihood: 'medium',
    impact: 'high',
    mitigation: 'EngineeringOS guardrails, drift detection, and regular verification.'
  });
  model = addRisk(model, {
    id: 'RISK-002',
    name: 'Supply-chain dependency risk',
    description: 'A vulnerable or abandoned dependency may undermine security.',
    likelihood: 'medium',
    impact: 'high',
    mitigation: 'Pin versions, scan dependencies, and review before adding new packages.'
  });
  model = addRisk(model, {
    id: 'RISK-003',
    name: 'Data integrity under concurrency',
    description: 'Concurrent writes may cause lost updates or partial states.',
    likelihood: 'medium',
    impact: 'high',
    mitigation: 'Transactions, optimistic locking, and idempotency keys.'
  });
  model = addRisk(model, {
    id: 'RISK-004',
    name: 'Scaling beyond design assumptions',
    description: 'Growth may exceed the capacity of a single artifact or store.',
    likelihood: 'low',
    impact: 'medium',
    mitigation: 'Stateless services, cacheable reads, and partitioned data stores.'
  });
  model = addRisk(model, {
    id: 'RISK-005',
    name: 'Security debt from unguarded changes',
    description: 'Expedient AI-generated changes may skip auth or leak secrets.',
    likelihood: 'medium',
    impact: 'high',
    mitigation: 'Security guardrails, secret scanning, and security review in Definition of Done.'
  });
  model = addRisk(model, {
    id: 'RISK-006',
    name: 'External gateway single point of failure',
    description: 'Payment/notification provider outages degrade core flows.',
    likelihood: 'medium',
    impact: 'medium',
    mitigation: 'Timeouts, retries with backoff, circuit breakers, and degraded-mode responses.'
  });

  // Failure modes + recovery strategies.
  model.failureModes = [
    { id: 'FM-001', name: 'Capability service failure', description: 'A capability is unavailable or inconsistent.', severity: 'warning', mitigation: 'Health checks, isolated modules, alerting.', evidence: [] },
    { id: 'FM-002', name: 'Data store outage', description: 'Persistence is unavailable, blocking reads and writes.', severity: 'blocking', mitigation: 'Retries, failover, backups.', evidence: [] },
    { id: 'FM-003', name: 'External provider timeout', description: 'Payment/notification provider exceeds its budget.', severity: 'warning', mitigation: 'Timeout, retry with backoff, circuit breaker.', evidence: [] },
    { id: 'FM-004', name: 'Data inconsistency', description: 'Partial writes or duplicate effects observed.', severity: 'blocking', mitigation: 'Transactions and idempotency.', evidence: [] }
  ];
  model.recoveryStrategies = [
    { id: 'RS-001', name: 'Retry with exponential backoff', description: 'Transient failures are retried with jitter and bounded attempts.', appliesTo: 'external calls' },
    { id: 'RS-002', name: 'Circuit breaker', description: 'Failing dependencies trip open and probe recovery.', appliesTo: 'external systems' },
    { id: 'RS-003', name: 'Idempotent replay', description: 'Consumers replay events without duplicating effects.', appliesTo: 'state-changing operations' },
    { id: 'RS-004', name: 'Rollback to previous artifact', description: 'Deploys are reversible in one action.', appliesTo: 'delivery' }
  ];

  return model;
}

function seedGuardrails(): Guardrails {
  const base = {
    schemaVersion: '1.0',
    modelVersion: 0
  };
  const g = (
    id: string,
    name: string,
    rule: string,
    severity: Guardrail['severity'],
    scope: string[],
    forbiddenPatterns: string[],
    enforcement: Guardrail['enforcement'],
    reason: string,
    verification: string[],
    allowedPatterns: string[] = []
  ): Guardrail => ({
    id,
    name,
    rule,
    severity,
    scope,
    allowedPatterns,
    forbiddenPatterns,
    enforcement,
    reason,
    verification
  });

  const src = ['src/**'];
  const srcNoTests = ['src/**', '!**/*.test.*', '!**/__tests__/**', '!**/tests/**', '!**/test/**'];
  const apiLayer = ['src/**/api/**', 'src/**/controllers/**', 'src/**/controller/**', 'src/**/routes/**', 'src/**/adapters/http/**', 'src/**/web/**', 'src/**/ui/**'];

  return {
    ...base,
    guardrails: [
      g(
        'GR-001',
        'No Secrets in Code',
        'Code must not contain hard-coded secrets, API keys, or credentials.',
        'blocking',
        src,
        ['(api[_-]?key|secret|password|access[_-]?token|client[_-]?secret)\\s*[:=]\\s*["\'][^"\']{8,}'],
        ['pattern'],
        'Prevents credential leakage into the repository.',
        ['pattern scan', 'secret scan']
      ),
      g(
        'GR-002',
        'No Client Database Access',
        'Client and UI code must never reach the database directly.',
        'blocking',
        ['src/client/**', 'src/web/**', 'src/ui/**'],
        ['createConnection', 'new Pool', 'pg\\.', 'mysql2', 'sequelize', 'typeorm', 'prisma', 'mongodb://'],
        ['import'],
        'Enforces the entry → service → repository → database boundary.',
        ['import validation']
      ),
      g(
        'GR-003',
        'Authorization Before Access',
        'Private resource access must be preceded by authorization.',
        'warning',
        src,
        ['router\\.(get|post|put|patch|delete)\\s*\\([^)]*\\)[\\s\\S]{0,300}(?:db\\.|firestore|query\\s*\\()'],
        ['pattern'],
        'Prevents unauthorized access to data.',
        ['review']
      ),
      g(
        'GR-004',
        'No Unsafe Dynamic Code Execution',
        'Never eval or construct functions from untrusted input.',
        'blocking',
        src,
        ['eval\\s*\\(', 'new\\s+Function\\s*\\('],
        ['pattern'],
        'Dynamic execution of untrusted input enables RCE.',
        ['pattern scan']
      ),
      g(
        'GR-005',
        'Parameterized Queries Only',
        'SQL must never be assembled by string concatenation or interpolation.',
        'blocking',
        src,
        ['(query|execute|raw|sql)\\s*\\([^)]*\\s*\\+\\s*', '(query|execute|raw|sql)\\s*\\([^)]*\\$\\{'],
        ['pattern'],
        'Prevents SQL injection.',
        ['pattern scan', 'review']
      ),
      g(
        'GR-006',
        'No Empty Catch Blocks',
        'Every catch must log, wrap, or rethrow with context.',
        'warning',
        src,
        ['catch\\s*\\([^)]*\\)\\s*\\{[\\s\\r\\n]*\\}', 'catch\\s*\\{[\\s\\r\\n]*\\}'],
        ['pattern'],
        'Swallowed errors make failures undiagnosable.',
        ['pattern scan']
      ),
      g(
        'GR-007',
        'No TODO/FIXME Left in Committed Code',
        'Committed code must not contain TODO, FIXME, or HACK markers.',
        'warning',
        srcNoTests,
        ['TODO\\s*[:]?', 'FIXME\\s*[:]?', 'HACK\\s*[:]?'],
        ['pattern'],
        'Unresolved markers indicate unfinished or fragile work.',
        ['pattern scan']
      ),
      g(
        'GR-008',
        'No Console Debug Logging in Production Paths',
        'Production code must log through the observability module, not the console.',
        'warning',
        srcNoTests,
        ['console\\.(log|debug)\\s*\\('],
        ['pattern'],
        'Console logging bypasses structured, correlation-carrying logging.',
        ['pattern scan']
      ),
      g(
        'GR-009',
        'No Explicit `any` in TypeScript',
        'Module boundaries must be fully typed.',
        'warning',
        srcNoTests,
        [':\\s*any\\b', 'as\\s+any\\b', '<any>'],
        ['pattern'],
        '`any` defeats the type system and hides defects.',
        ['pattern scan', 'typecheck']
      ),
      g(
        'GR-010',
        'Tests Required for New Logic',
        'Scoped source files must have an adjacent test file.',
        'blocking',
        srcNoTests,
        [],
        ['test'],
        'New logic without tests cannot be verified.',
        ['adjacent test check']
      ),
      g(
        'GR-011',
        'No Business Logic in Entry/Controller Layer',
        'Controllers must not import repository, persistence, or domain-model internals.',
        'warning',
        apiLayer,
        ['**/repositories/**', '**/repository/**', '**/persistence/**', '**/db/**', '**/data/**', '**/models/**', '**/domain/entities/**'],
        ['file-boundary'],
        'Keeps business logic out of the HTTP layer and honors the dependency rule.',
        ['boundary validation']
      ),
      g(
        'GR-012',
        'No Direct Filesystem Access from API Layer',
        'The API/entry layer must not touch the filesystem directly.',
        'warning',
        apiLayer,
        ['node:fs', 'fs', 'fs/promises', 'file-system'],
        ['import'],
        'Filesystem concerns belong in dedicated infrastructure adapters.',
        ['import validation']
      ),
      g(
        'GR-013',
        'No Hardcoded URLs or Connection Strings',
        'Environment-specific endpoints and connection strings must not be literals in code.',
        'warning',
        srcNoTests,
        ['(postgres|postgresql|mysql|mongodb|redis|amqp)://[^"\']*["\']', 'https?://[a-z0-9.-]+\\.[a-z]{2,}["\']'],
        ['pattern'],
        'Environment-specific values belong in validated configuration.',
        ['pattern scan']
      ),
      g(
        'GR-014',
        'Domain Layer Has No Framework Dependencies',
        'Domain modules must not import HTTP or framework modules.',
        'warning',
        ['src/**/domain/**', 'src/**/core/**'],
        ['**/http/**', '**/express/**', '**/koa/**', '**/next/**', '**/api/**', '**/router/**', '**/react/**', '**/vue/**'],
        ['file-boundary'],
        'Keeps business rules framework-agnostic and testable.',
        ['boundary validation']
      )
    ]
  };
}

function capabilitiesPair(capabilities: string[], capability: string): boolean {
  return capabilities.indexOf(capability) < capabilities.length - 1;
}

function nextCapability(capabilities: string[], capability: string): string {
  return capabilities[capabilities.indexOf(capability) + 1] ?? capability;
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function describeList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
