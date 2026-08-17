import * as vscode from 'vscode';
import { EngineeringOSEngine, type AnalysisResult, type OnboardingInput } from '../engine';
import type { AgentState } from '../agents/adapter';
import type { Blueprint, ContextPackage, Map, MentalModel, Guardrails, ImpactReport, DriftFinding } from '../core/types';
import { evaluateOverallQuality, evaluateMapQuality, evaluateMentalModelQuality, evaluateGuardrailsQuality, evaluateBlueprintQuality } from '../quality/engine';
import { buildDomainModelPrompt, buildGuardrailsPrompt, buildThreatModelPrompt } from '../ai/prompts';
import { getWebviewContent } from './webview/content';

interface OverviewPayload {
  projectName: string;
  purpose: string;
  counts: { components: number; requirements: number; invariants: number; guardrails: number; risks: number; unknowns: number };
  verification?: { overall: string };
  blueprint?: { sections: number; architectureStyle: string; securityLevel: string; aiEnabled: boolean };
  quality?: { score: number; grade: string; map: number; mentalModel: number; guardrails: number; blueprint: number; recommendations: string[] };
}

interface MapPayload {
  systemPurpose: string;
  components: { id: string; name: string; purpose: string; dependencies: string[]; dependents: string[]; sourceLocations: string[] }[];
  workflows: { name: string; description: string }[];
  requirements: { id: string; text: string; priority: string }[];
}

interface ModelPayload {
  systemPurpose: string;
  invariants: { id: string; statement: string; severity: string }[];
  decisions: { id: string; decision: string }[];
  risks: { id: string; name: string; description: string; likelihood: string; impact: string }[];
  unknowns: { id: string; question: string }[];
}

interface GuardrailsPayload {
  guardrails: { id: string; name: string; rule: string; reason: string; severity: string }[];
}

interface VerifyPayload {
  overall: string;
  results: { check: string; verdict: string; evidence: string[]; notVerified: string[] }[];
  signals: { ruleId: string; severity: string; message: string; file: string }[];
}

interface WebviewState {
  initialized: boolean;
  overview: OverviewPayload;
  map: MapPayload;
  model: ModelPayload;
  guardrails: GuardrailsPayload;
  verify?: VerifyPayload;
  activeContext?: { estimatedTokens: number; files: number; contains: string[]; serialized: string };
  activeImpact?: { target: string; severity: string; affectedComponents: { name: string }[]; affectedWorkflows: string[]; requiredVerification: string[] };
  activeAsk?: boolean;
  activeUpdate?: { findings: DriftFinding[] };
}

export class EngineeringOSSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'engineeringos.sidebar';
  private view?: vscode.WebviewView;
  private pendingState?: WebviewState;

  constructor(private readonly engine: EngineeringOSEngine) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
    webviewView.webview.html = getWebviewContent();
    webviewView.webview.onDidReceiveMessage((msg) => void this.handleMessage(msg));
    if (this.pendingState) {
      webviewView.webview.postMessage({ type: 'state', payload: this.pendingState });
      this.pendingState = undefined;
    }
  }

  private async handleMessage(msg: { type: string; command?: string; payload?: unknown }): Promise<void> {
    switch (msg.type) {
      case 'ready':
        await this.refresh();
        break;
      case 'onboarding.submit':
        await this.handleOnboarding(msg.payload as OnboardingInput & { users: string[]; capabilities: string[] });
        break;
      case 'command':
        await this.handleCommand(msg.command ?? '', msg.payload);
        break;
      case 'wizard.ai.suggest':
        await this.handleAISuggest((msg as Record<string, unknown>).phaseId as string);
        break;
      case 'wizard.complete':
        await this.handleWizardComplete(msg.payload as Record<string, unknown>);
        break;
    }
  }

  private async handleOnboarding(payload: OnboardingInput & { users: string[]; capabilities: string[] }): Promise<void> {
    const projectId = payload.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
    const result = await this.engine.buildOnboardingModel({
      projectName: payload.projectName,
      projectId,
      purpose: payload.purpose,
      primaryUsers: payload.users,
      criticalCapabilities: payload.capabilities,
      guardrailSeed: true,
      architectureStyle: payload.architectureStyle,
      securityLevel: payload.securityLevel,
      language: payload.language,
      runtime: payload.runtime,
      framework: payload.framework,
      database: payload.database,
      blueprintText: payload.blueprintText
    });
    void vscode.window.showInformationMessage(
      `EngineeringOS model built: ${result.map.components.length} components, ${result.guardrails.guardrails.length} guardrails, ${result.blueprint.sections.length} blueprint sections.` +
      (result.quality ? ` Quality: ${result.quality.grade} (${result.quality.score}/100).` : '')
    );
    if (result.blueprintNote) {
      void vscode.window.showWarningMessage(result.blueprintNote);
    }
    await this.refresh();
  }

  private async handleAISuggest(phaseId: string): Promise<void> {
    try {
      const config = await this.engine.repository.loadConfig();
      const client = config ? (await import('../ai/provider')).createAIClient(config) : null;
      let suggestions: Record<string, string[]> = {};

      if (client && client.isConfigured && config) {
        try {
          let prompt: { system: string; user: string } | null = null;
          if (phaseId === 'domain') {
            prompt = buildDomainModelPrompt({
              projectName: config.projectName,
              purpose: '',
              primaryUsers: [],
              criticalCapabilities: []
            });
          } else if (phaseId === 'guardrails') {
            prompt = buildGuardrailsPrompt({
              projectName: config.projectName,
              purpose: ''
            });
          } else if (phaseId === 'threats') {
            prompt = buildThreatModelPrompt({
              projectName: config.projectName,
              purpose: ''
            });
          }

          if (prompt) {
            const responseText = await client.complete({ system: prompt.system, user: prompt.user, temperature: 0.3, maxTokens: 2000 });
            try {
              const parsed = JSON.parse(responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as Record<string, unknown>;
              for (const [key, val] of Object.entries(parsed)) {
                if (Array.isArray(val)) {
                  suggestions[key] = val.map((v) => typeof v === 'string' ? v : JSON.stringify(v));
                } else if (typeof val === 'string') {
                  suggestions[key] = [val];
                }
              }
            } catch {
              suggestions = { suggestions: [responseText.slice(0, 500)] };
            }
          }
        } catch {
          // AI call failed; return empty suggestions.
        }
      }

      if (this.view) {
        this.view.webview.postMessage({
          type: 'wizard.ai.suggest.result',
          phaseId,
          data: suggestions
        });
      }
    } catch (err) {
      void vscode.window.showErrorMessage(`AI suggest failed: ${err instanceof Error ? err.message : String(err)}`);
      if (this.view) {
        this.view.webview.postMessage({
          type: 'wizard.ai.suggest.result',
          phaseId,
          data: {}
        });
      }
    }
  }

  private async handleWizardComplete(payload: Record<string, unknown>): Promise<void> {
    const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim()) ? v.trim() : undefined;
    const strArr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];

    const projectName = str(payload.projectName) || 'Untitled Project';
    const projectId = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';

    const input: OnboardingInput = {
      projectName,
      projectId,
      purpose: str(payload.purpose) || '',
      primaryUsers: strArr(payload.users),
      criticalCapabilities: strArr(payload.capabilities),
      guardrailSeed: true,
      entities: strArr(payload.entities),
      valueObjects: strArr(payload.valueObjects),
      boundedContexts: strArr(payload.boundedContexts),
      domainEvents: strArr(payload.domainEvents),
      authProvider: str(payload.authProvider),
      paymentProviders: strArr(payload.paymentProviders),
      notificationProviders: strArr(payload.notificationProviders),
      storageProviders: strArr(payload.storageProviders),
      otherIntegrations: strArr(payload.otherIntegrations),
      targetLatency: str(payload.targetLatency),
      targetConcurrency: str(payload.targetConcurrency),
      availability: str(payload.availability),
      threatLevel: str(payload.threatLevel) as OnboardingInput['threatLevel'],
      compliance: strArr(payload.compliance),
      dataRetention: str(payload.dataRetention),
      slaRequirements: str(payload.slaRequirements),
      architectureStyle: str(payload.architectureStyle),
      securityLevel: str(payload.securityLevel) as OnboardingInput['securityLevel'],
      language: str(payload.language),
      runtime: str(payload.runtime),
      framework: str(payload.framework),
      database: str(payload.database),
      blueprintText: str(payload.blueprintText)
    };

    try {
      const result = await this.engine.buildOnboardingModel(input, (phase, progress) => {
        if (this.view) {
          this.view.webview.postMessage({ type: 'wizard.progress', phase, progress });
        }
      });
      void vscode.window.showInformationMessage(
        `EngineeringOS model built: ${result.map.components.length} components, ${result.guardrails.guardrails.length} guardrails, ${result.blueprint.sections.length} blueprint sections.` +
        (result.quality ? ` Quality: ${result.quality.grade} (${result.quality.score}/100).` : '')
      );
      if (result.blueprintNote) {
        void vscode.window.showWarningMessage(result.blueprintNote);
      }
      await this.refresh();
    } catch (err) {
      void vscode.window.showErrorMessage(`Build failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async handleCommand(command: string, payload: unknown): Promise<void> {
    switch (command) {
      case 'verify':
        await this.verify();
        break;
      case 'analyze':
        await this.impact();
        break;
      case 'context':
        await this.context();
        break;
      case 'update':
        await this.update();
        break;
      case 'acceptUpdate':
        await this.acceptUpdate();
        break;
      case 'dismissUpdate':
        await this.refresh();
        break;
      case 'ask':
        await this.answer(payload as string);
        break;
      case 'copyContext':
        if (typeof payload === 'string') {
          await vscode.env.clipboard.writeText(payload);
          void vscode.window.showInformationMessage('Agent context copied to clipboard.');
        }
        break;
      case 'openBlueprint':
        await this.openBlueprint();
        break;
      case 'reset':
        await this.reset();
        break;
      case 'showOverview':
      case 'showMap':
      case 'showMentalModel':
      case 'showGuardrails':
        await this.refresh();
        break;
    }
  }

  async initialize(): Promise<void> {
    const initialized = await this.engine.isInitialized();
    if (initialized) {
      await this.refresh();
      return;
    }
    await this.post({ initialized: false } as WebviewState);
  }

  async reset(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      'Reset EngineeringOS model? This will delete all generated artifacts (map, mental model, guardrails, blueprint). This cannot be undone.',
      'Reset',
      'Cancel'
    );
    if (confirm !== 'Reset') return;
    await this.engine.repository.reset();
    await this.post({ initialized: false } as WebviewState);
    void vscode.window.showInformationMessage('EngineeringOS model reset. Use the wizard to build a new model.');
  }

  async showView(view: 'overview' | 'map' | 'model' | 'guardrails'): Promise<void> {
    const state = await this.loadForUi();
    await this.post({ ...state });
    this.view?.webview.postMessage({ type: 'view', view });
  }

  async verify(): Promise<AnalysisResult | undefined> {
    const analysis = await this.engine.verifyChange();
    await this.presentVerification(analysis);
    return analysis;
  }

  async impact(): Promise<void> {
    const target = await vscode.window.showInputBox({
      prompt: 'What change are you considering?',
      placeHolder: 'e.g. Replace the payment provider adapter'
    });
    if (!target) return;
    const impact = await this.engine.predictImpact(target);
    await this.presentImpact(impact);
  }

  async context(): Promise<void> {
    const task = await vscode.window.showInputBox({
      prompt: 'What is the task you will give the AI agent?',
      placeHolder: 'e.g. Make order cancellation idempotent'
    });
    if (!task) return;
    const { package: pkg, serialized } = await this.engine.prepareContext(task);
    await this.presentContext(pkg, serialized);
  }

  async update(): Promise<void> {
    const analysis = await this.engine.verifyChange();
    const findings = analysis.drift.findings;
    if (findings.length === 0) {
      void vscode.window.showInformationMessage('No drift detected — model matches workspace.');
      return;
    }
    await this.presentUpdate(findings);
  }

  async ask(): Promise<void> {
    const state = await this.loadForUi();
    await this.post({ ...state, activeAsk: true });
  }

  async openBlueprint(): Promise<void> {
    const blueprintPath = this.engine.repository.paths.generatedBlueprint;
    try {
      const doc = await vscode.workspace.openTextDocument(blueprintPath);
      await vscode.window.showTextDocument(doc, { preview: true });
    } catch {
      void vscode.window.showWarningMessage('Blueprint not generated yet. Run EngineeringOS: Generate Blueprint first.');
    }
  }

  private async answer(question: string): Promise<void> {
    const state = await this.engine.loadState();
    if (!state) {
      void vscode.window.showWarningMessage('Initialize EngineeringOS first.');
      return;
    }

    const ai = await this.engine.answerQuestion(question).catch(() => null);
    if (ai) {
      const parts = [ai.answer];
      const summary = await this.engine.prepareContext(question);
      parts.push(`\n\n[AI answer grounded in the engineering model · context written to .engineeringos/generated/contexts/current-task.json · ~${summary.package.estimatedTokens} tokens]`);
      const doc = await vscode.workspace.openTextDocument({
        content: parts.join('\n'),
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true });
      return;
    }

    const q = question.toLowerCase();
    const parts: string[] = [];
    if (/(depend|affect|impact|break|touch)/.test(q)) {
      const impact = await this.engine.predictImpact(question);
      parts.push(`IMPACT ANALYSIS for "${impact.target}": ${impact.severity} risk.`);
      if (impact.affectedComponents.length) parts.push(`Affected: ${impact.affectedComponents.map((c) => c.name).join(', ')}.`);
      if (impact.affectedWorkflows.length) parts.push(`Workflows: ${impact.affectedWorkflows.join(', ')}.`);
    } else if (/unknown|risk|don'?t know|unsure|unclear/.test(q)) {
      if (state.mentalModel.unknowns.length) parts.push('Open unknowns: ' + state.mentalModel.unknowns.map((u) => `${u.id}: ${u.question}`).join(' | '));
      if (state.mentalModel.risks.length) parts.push('Tracked risks: ' + state.mentalModel.risks.map((r) => r.name).join(', '));
      if (!parts.length) parts.push('No open unknowns recorded in the mental model.');
    } else if (/architect|structure|component|module|layer/.test(q)) {
      if (state.map.components.length) parts.push('Components: ' + state.map.components.map((c) => `${c.id} (${c.purpose})`).join(' | '));
      if (state.map.relationships.length) parts.push('Relationships: ' + state.map.relationships.map((r) => `${r.from} -> ${r.to} [${r.type}]`).join(' | '));
    } else if (/invariant|rule|guardrail|constraint/.test(q)) {
      parts.push('Guardrails: ' + state.guardrails.guardrails.map((g) => `${g.id}: ${g.name} [${g.severity}]`).join(' | '));
      parts.push('Invariants: ' + state.mentalModel.invariants.map((i) => `${i.id}: ${i.statement} [${i.severity}]`).join(' | '));
    }
    if (!parts.length) {
      const impact = await this.engine.predictImpact(question);
      parts.push(`I analyzed the question against the model. Best-guess impact: ${impact.severity}.`);
      if (impact.affectedComponents.length) parts.push(`Possibly affected: ${impact.affectedComponents.map((c) => c.name).join(', ')}.`);
    }
    const summary = await this.engine.prepareContext(question);
    const answerText = parts.join('\n') + `\n\n[Agent-ready context written to .engineeringos/generated/contexts/current-task.json · ~${summary.package.estimatedTokens} tokens]`;
    const doc = await vscode.workspace.openTextDocument({
      content: answerText,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true });
  }

  private async acceptUpdate(): Promise<void> {
    try {
      const state = await this.engine.loadStateOrThrow();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const content = [
        `# Model Update Record ${stamp}`,
        '',
        `Date: ${new Date().toISOString()}`,
        `Component count: ${state.map.components.length}`,
        `Guardrails: ${state.guardrails.guardrails.length}`,
        '',
        'A drift-driven review was acknowledged. Review `git diff .engineeringos/` and update `map.json` / `mental-model.json` / `guardrails.json` accordingly.'
      ].join('\n');
      await this.engine.writeAdr(`drift-update-${stamp}.md`, content);
      void vscode.window.showInformationMessage('Drift review acknowledged. Adjust .engineeringos/*.json to reconcile the model.');
      await this.refresh();
    } catch (err) {
      void vscode.window.showErrorMessage(`Update failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async presentVerification(analysis: AnalysisResult): Promise<void> {
    const state = await this.loadForUi();
    const verify: VerifyPayload = {
      overall: analysis.verification.overall,
      results: analysis.verification.results.map((r) => ({
        check: r.check,
        verdict: r.verdict,
        evidence: r.evidence,
        notVerified: r.notVerified
      })),
      signals: analysis.guardrails.signals.map((s) => ({
        ruleId: s.ruleId,
        severity: s.severity,
        message: s.message,
        file: s.file
      }))
    };
    await this.post({ ...state, verify });
  }

  private async presentImpact(impact: ImpactReport): Promise<void> {
    const state = await this.loadForUi();
    await this.post({
      ...state,
      activeImpact: {
        target: impact.target,
        severity: impact.severity,
        affectedComponents: impact.affectedComponents.map((c) => ({ name: `${c.name} (${c.kind})` })),
        affectedWorkflows: impact.affectedWorkflows,
        requiredVerification: impact.requiredVerification
      }
    });
  }

  private async presentContext(pkg: ContextPackage, serialized: string): Promise<void> {
    const state = await this.loadForUi();
    await this.post({
      ...state,
      activeContext: {
        estimatedTokens: pkg.estimatedTokens,
        files: pkg.relevantComponents.length,
        contains: [
          'requirements', 'components', 'invariants', 'guardrails', 'decisions', 'risks', 'verification plan'
        ],
        serialized
      }
    });
  }

  private async presentUpdate(findings: DriftFinding[]): Promise<void> {
    const state = await this.loadForUi();
    await this.post({ ...state, activeUpdate: { findings } });
  }

  private async loadForUi(): Promise<WebviewState> {
    const state = await this.engine.loadState();
    if (!state) return { initialized: false } as WebviewState;
    const [blueprint, aiStatus] = await Promise.all([
      this.engine.repository.loadBlueprint(),
      this.engine.aiStatus()
    ]);
    return buildState(state, blueprint, aiStatus.configured);
  }

  private async post(state: WebviewState): Promise<void> {
    if (this.view) {
      await this.view.webview.postMessage({ type: 'state', payload: state });
    } else {
      this.pendingState = state;
    }
  }

  async refresh(): Promise<void> {
    const initialized = await this.engine.isInitialized();
    let state: WebviewState;
    if (initialized) {
      const loaded = await this.engine.loadState();
      state = loaded ? await this.loadForUi() : ({ initialized: false } as WebviewState);
    } else {
      state = { initialized: false } as WebviewState;
    }
    await this.post(state);
  }
}

function buildState(
  state: AgentState,
  blueprint?: Blueprint | null,
  aiEnabled = false
): WebviewState {
  const map = state.map as Map;
  const mentalModel = state.mentalModel as MentalModel;
  const guardrails = (state.guardrails as Guardrails).guardrails;

  const overview: OverviewPayload = {
    projectName: map.project.name,
    purpose: map.project.purpose ?? '',
    counts: {
      components: map.components.length,
      requirements: map.requirements.length,
      invariants: mentalModel.invariants.length,
      guardrails: guardrails.length,
      risks: mentalModel.risks.length,
      unknowns: mentalModel.unknowns.length
    }
  };
  if (blueprint) {
    overview.blueprint = {
      sections: blueprint.sections.length,
      architectureStyle: blueprint.architectureStyle,
      securityLevel: blueprint.securityLevel,
      aiEnabled
    };
  }

  // Compute quality score from current state.
  const grQ = evaluateGuardrailsQuality((state.guardrails as Guardrails), mentalModel);
  let bpQ: ReturnType<typeof evaluateBlueprintQuality> | null = null;
  let overallQ: ReturnType<typeof evaluateOverallQuality> | null = null;
  if (blueprint) {
    bpQ = evaluateBlueprintQuality(blueprint);
    overallQ = evaluateOverallQuality(map, mentalModel, (state.guardrails as Guardrails), blueprint);
  }
  const mapQ = evaluateMapQuality(map);
  const mmQ = evaluateMentalModelQuality(mentalModel);
  if (overallQ) {
    overview.quality = {
      score: overallQ.score,
      grade: overallQ.grade,
      map: mapQ.score,
      mentalModel: mmQ.score,
      guardrails: grQ.score,
      blueprint: bpQ ? bpQ.score : 0,
      recommendations: overallQ.recommendations.slice(0, 5)
    };
  }

  const mapPayload: MapPayload = {
    systemPurpose: mentalModel.systemUnderstanding.businessObjective ?? map.project.purpose ?? '',
    components: map.components.map((c) => ({
      id: c.id,
      name: c.name,
      purpose: c.purpose,
      dependencies: c.dependencies,
      dependents: c.dependents,
      sourceLocations: c.sourceLocations
    })),
    workflows: map.workflows.map((w) => ({ name: w.name, description: w.description ?? '' })),
    requirements: map.requirements.map((r) => ({ id: r.id, text: r.text, priority: r.priority }))
  };

  const modelPayload: ModelPayload = {
    systemPurpose: mentalModel.systemUnderstanding.businessObjective ?? '',
    invariants: mentalModel.invariants.map((i) => ({ id: i.id, statement: i.statement, severity: i.severity })),
    decisions: mentalModel.decisions.map((d) => ({ id: d.id, decision: d.decision })),
    risks: mentalModel.risks.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      likelihood: r.likelihood,
      impact: r.impact
    })),
    unknowns: mentalModel.unknowns.map((u) => ({ id: u.id, question: u.question }))
  };

  const guardrailsPayload: GuardrailsPayload = {
    guardrails: guardrails.map((g) => ({
      id: g.id,
      name: g.name,
      rule: g.rule,
      reason: g.reason ?? '',
      severity: g.severity
    }))
  };

  return {
    initialized: true,
    overview,
    map: mapPayload,
    model: modelPayload,
    guardrails: guardrailsPayload
  };
}
