import * as vscode from 'vscode';
import { EngineeringOSEngine } from './engine';
import { EngineeringOSSidebarProvider } from './ui/sidebar';
import type { Blueprint } from './core/types';

const COMMANDS = [
  'engineeringos.ask',
  'engineeringos.showOverview',
  'engineeringos.showMap',
  'engineeringos.showMentalModel',
  'engineeringos.showGuardrails',
  'engineeringos.analyzeChange',
  'engineeringos.predictImpact',
  'engineeringos.verify',
  'engineeringos.updateModel',
  'engineeringos.prepareContext',
  'engineeringos.showRisks',
  'engineeringos.showUnknowns',
  'engineeringos.explainArchitecture',
  'engineeringos.initialize',
  'engineeringos.resetModel',
  'engineeringos.generateBlueprint',
  'engineeringos.openBlueprint',
  'engineeringos.analyzeRepository',
  'engineeringos.runExecutableGuardrails',
  'engineeringos.healthReport'
] as const;

export function activate(context: vscode.ExtensionContext): void {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    void vscode.window.showWarningMessage('EngineeringOS requires an open workspace folder.');
    return;
  }

  const engine = new EngineeringOSEngine(workspace.uri.fsPath);
  const provider = new EngineeringOSSidebarProvider(engine);

  const sidebar = vscode.window.registerWebviewViewProvider(EngineeringOSSidebarProvider.viewType, provider);
  context.subscriptions.push(sidebar);

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 80);
  statusBar.text = '$(circuit-board) EngineeringOS';
  statusBar.tooltip = 'EngineeringOS — engineering intelligence for AI coding agents';
  statusBar.command = 'engineeringos.showOverview';
  statusBar.show();
  context.subscriptions.push(statusBar);

  const handlers: Record<(typeof COMMANDS)[number], () => Promise<void>> = {
    'engineeringos.initialize': async () => {
      await revealSidebar();
      await provider.initialize();
    },

    'engineeringos.resetModel': async () => {
      await revealSidebar();
      await provider.reset();
    },

    'engineeringos.generateBlueprint': async () => {
      const state = await engine.loadState();
      if (!state) {
        void vscode.window.showWarningMessage('Initialize EngineeringOS first.');
        return;
      }
      const ai = await engine.aiStatus();
      const blueprint = await engine.generateBlueprint();
      await vscode.window.showInformationMessage(
        `Blueprint regenerated: ${blueprint.sections.length} sections${ai.configured ? ' (AI-assisted)' : ''}.`
      );
      await openMarkdownFile(engine, blueprint);
      await provider.refresh();
    },

    'engineeringos.openBlueprint': async () => {
      await openMarkdownFile(engine);
    },

    'engineeringos.showOverview': async () => {
      await revealSidebar();
      await provider.showView('overview');
    },

    'engineeringos.showMap': async () => {
      await revealSidebar();
      await provider.showView('map');
    },

    'engineeringos.showMentalModel': async () => {
      await revealSidebar();
      await provider.showView('model');
    },

    'engineeringos.showGuardrails': async () => {
      await revealSidebar();
      await provider.showView('guardrails');
    },

    'engineeringos.verify': async () => {
      const result = await withInitialized(() => provider.verify());
      if (result) {
        updateStatusBar(statusBar, result.verification.overall);
        await notifyVerification(result.verification.overall, result.drift.findings.length);
      }
    },

    'engineeringos.analyzeChange': async () => {
      await withInitialized(() => provider.impact());
    },

    'engineeringos.predictImpact': async () => {
      await withInitialized(() => provider.impact());
    },

    'engineeringos.updateModel': async () => {
      await withInitialized(() => provider.update());
    },

    'engineeringos.prepareContext': async () => {
      await withInitialized(() => provider.context());
    },

    'engineeringos.ask': async () => {
      await withInitialized(() => provider.ask());
    },

    'engineeringos.showRisks': async () => {
      const state = await engine.loadState();
      if (!state) return;
      const content = state.mentalModel.risks
        .map((r) => `## ${r.name} (${r.likelihood}/${r.impact})\n\n${r.description}\n\nMitigation: ${r.mitigation}`)
        .join('\n\n---\n\n');
      await openMarkdown(`# Risks\n\n${content || '_No tracked risks._'}`);
    },

    'engineeringos.showUnknowns': async () => {
      const state = await engine.loadState();
      if (!state) return;
      const content = state.mentalModel.unknowns
        .map((u) => `- **${u.id}** ${u.question} [${u.status}]\n`)
        .join('');
      await openMarkdown(`# Open Unknowns\n\n${content || '_No open unknowns._'}`);
    },

    'engineeringos.explainArchitecture': async () => {
      const state = await engine.loadState();
      if (!state) return;
      const lines: string[] = ['# Architecture Overview', ''];
      if (state.mentalModel.systemUnderstanding.businessObjective) {
        lines.push(`**Objective:** ${state.mentalModel.systemUnderstanding.businessObjective}`, '');
      }
      lines.push('## Components', '');
      for (const c of state.map.components) {
        lines.push(`- **${c.name}** — ${c.purpose}`);
        if (c.sourceLocations.length) lines.push(`  Locations: ${c.sourceLocations.join(', ')}`);
      }
      lines.push('', '## Relationships', '');
      for (const r of state.map.relationships) {
        lines.push(`- \`${r.from}\` → \`${r.to}\` [${r.type}] — ${r.description}`);
      }
      await openMarkdown(lines.join('\n'));
    },

    'engineeringos.analyzeRepository': async () => {
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Analyzing repository...' }, async () => {
        try {
          const { snapshot, graph } = await engine.analyzeRepository();
          const lines: string[] = [
            '# Repository Analysis',
            '',
            `**Files:** ${snapshot.stats.totalFiles}`,
            `**Languages:** ${Object.entries(snapshot.stats.languages).map(([k, v]) => `${k} (${v})`).join(', ')}`,
            `**Test files:** ${snapshot.stats.testFiles}`,
            `**Modules:** ${graph.modules.length}`,
            `**Data stores:** ${graph.data.length}`,
            `**Contracts:** ${graph.contracts.length}`,
            `**Security findings:** ${snapshot.security.length}`,
            ''
          ];
          if (snapshot.security.length > 0) {
            lines.push('## Security Findings', '');
            for (const s of snapshot.security.slice(0, 20)) {
              lines.push(`- **${s.severity.toUpperCase()}** ${s.description} at \`${s.file}:${s.line}\``);
            }
            lines.push('');
          }
          lines.push('## Modules', '');
          for (const m of graph.modules.slice(0, 30)) {
            lines.push(`- \`${m.path}\` — ${m.symbols.length} symbols, ${m.exports.length} exports`);
          }
          await openMarkdown(lines.join('\n'));
          await vscode.window.showInformationMessage(`Repository analyzed: ${snapshot.stats.totalFiles} files, ${graph.modules.length} modules.`);
        } catch (err) {
          await vscode.window.showErrorMessage(`Repository analysis failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    },

    'engineeringos.runExecutableGuardrails': async () => {
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Running executable guardrails...' }, async () => {
        try {
          const result = await engine.runExecutableGuardrails();
          const lines: string[] = [
            '# Executable Guardrail Results',
            '',
            `**Overall:** ${result.overall}`,
            `**Violations:** ${result.violations.length}`,
            ''
          ];
          if (result.violations.length > 0) {
            for (const v of result.violations) {
              lines.push(`- **${v.severity}** [${v.ruleId}] ${v.message}`);
              if (v.file) lines.push(`  File: \`${v.file}${v.line ? `:${v.line}` : ''}\``);
              if (v.remediation) lines.push(`  Remediation: ${v.remediation}`);
              lines.push('');
            }
          } else {
            lines.push('_No violations found._');
          }
          await openMarkdown(lines.join('\n'));
          if (result.overall === 'BLOCK') {
            await vscode.window.showErrorMessage(`Guardrails BLOCKED: ${result.violations.length} violation(s)`);
          } else if (result.overall === 'REVIEW' || result.overall === 'WARN') {
            await vscode.window.showWarningMessage(`Guardrails REVIEW: ${result.violations.length} finding(s)`);
          } else {
            await vscode.window.showInformationMessage('Guardrails: PASS');
          }
        } catch (err) {
          await vscode.window.showErrorMessage(`Guardrail check failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    },

    'engineeringos.healthReport': async () => {
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Computing health score...' }, async () => {
        try {
          const report = await engine.computeHealthScore();
          const lines: string[] = [
            '# Engineering Health Report',
            '',
            `**Overall Score:** ${(report.overall * 100).toFixed(0)}% (${report.grade})`,
            ''
          ];
          if (report.criticalOverrides.length > 0) {
            lines.push('## Critical Overrides', '');
            for (const o of report.criticalOverrides) lines.push(`- ${o}`);
            lines.push('');
          }
          lines.push('## Dimensions', '');
          for (const d of report.dimensions) {
            const score = (d.score * 100).toFixed(0);
            lines.push(`- **${d.name}** (${(d.weight * 100).toFixed(0)}%): ${score}%`);
            for (const e of d.evidence) {
              const icon = e.status === 'good' ? '+' : e.status === 'warning' ? '!' : 'X';
              lines.push(`  [${icon}] ${e.label}: ${e.value} ${e.unit}`);
            }
          }
          if (report.recommendations.length > 0) {
            lines.push('', '## Recommendations', '');
            for (const r of report.recommendations) {
              lines.push(`- **${r.priority.toUpperCase()}** ${r.message}`);
              lines.push(`  Remediation: ${r.remediation}`);
            }
          }
          await openMarkdown(lines.join('\n'));
          await vscode.window.showInformationMessage(`Health: ${(report.overall * 100).toFixed(0)}% (${report.grade})`);
        } catch (err) {
          await vscode.window.showErrorMessage(`Health report failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    }
  };

  for (const id of COMMANDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, () => {
        void handlers[id]();
      })
    );
  }

  let watcherTimer: NodeJS.Timeout | undefined;
  const watchers = vscode.workspace.createFileSystemWatcher('**/*.{ts,js,tsx,jsx,mjs,cjs,py,go,rs,java,json}');
  const scheduleVerify = (): void => {
    if (watcherTimer) clearTimeout(watcherTimer);
    watcherTimer = setTimeout(() => {
      void quickVerify(engine, statusBar);
    }, 1500);
  };
  watchers.onDidCreate(scheduleVerify);
  watchers.onDidChange(scheduleVerify);
  watchers.onDidDelete(scheduleVerify);
  context.subscriptions.push(watchers);

  void startup(engine, statusBar, provider);
}

async function withInitialized<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Error && err.message.includes('not initialized')) {
      const go = 'Initialize';
      const pick = await vscode.window.showInformationMessage(err.message, go);
      if (pick === go) await vscode.commands.executeCommand('engineeringos.initialize');
      return undefined;
    }
    void vscode.window.showErrorMessage(`EngineeringOS: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

async function revealSidebar(): Promise<void> {
  await vscode.commands.executeCommand('engineeringos.sidebar.focus');
}

async function quickVerify(engine: EngineeringOSEngine, statusBar: vscode.StatusBarItem): Promise<void> {
  if (!(await engine.isInitialized())) return;
  try {
    const result = await engine.verifyChange();
    updateStatusBar(statusBar, result.verification.overall);
  } catch {
    // workspace not fully readable; keep last status
  }
}

function updateStatusBar(statusBar: vscode.StatusBarItem, overall: string): void {
  const icon = overall === 'BLOCK' ? '$(error)' : overall === 'REVIEW' ? '$(warning)' : '$(check)';
  statusBar.text = `${icon} EngineeringOS · ${overall}`;
  statusBar.tooltip = `EngineeringOS — last verification: ${overall}`;
}

async function notifyVerification(overall: string, driftCount: number): Promise<void> {
  const message =
    overall === 'BLOCK'
      ? 'EngineeringOS: verification BLOCKED — guardrails violated.'
      : overall === 'REVIEW'
        ? `EngineeringOS: needs review (${driftCount} drift finding${driftCount === 1 ? '' : 's'}).`
        : 'EngineeringOS: verification PASSED.';
  if (overall === 'BLOCK' || overall === 'REVIEW') {
    void vscode.window.showWarningMessage(message, 'Inspect').then((pick) => {
      if (pick === 'Inspect') void vscode.commands.executeCommand('engineeringos.verify');
    });
  } else {
    void vscode.window.setStatusBarMessage(message, 3000);
  }
}

async function openMarkdown(content: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
  await vscode.window.showTextDocument(doc, { preview: true });
}

async function openMarkdownFile(engine: EngineeringOSEngine, blueprint?: Blueprint): Promise<void> {
  const bp = blueprint ?? (await engine.repository.loadBlueprint());
  if (!bp) {
    void vscode.window.showWarningMessage('No blueprint generated yet. Run "EngineeringOS: Generate Engineering Blueprint" first.');
    return;
  }
  const doc = await vscode.workspace.openTextDocument(engine.repository.paths.generatedBlueprint);
  await vscode.window.showTextDocument(doc, { preview: true });
}

async function startup(engine: EngineeringOSEngine, statusBar: vscode.StatusBarItem, provider: EngineeringOSSidebarProvider): Promise<void> {
  const initialized = await engine.isInitialized();
  if (initialized) {
    statusBar.text = '$(circuit-board) EngineeringOS · ready';
    const result = await engine.verifyChange().catch(() => null);
    if (result) {
      updateStatusBar(statusBar, result.verification.overall);
      await notifyVerification(result.verification.overall, result.drift.findings.length);
    }
  } else {
    statusBar.text = '$(circuit-board) EngineeringOS · not initialized';
    await revealSidebar();
    await provider.initialize();
  }
}

export function deactivate(): void {
  // noop
}
