import { EngineeringOSEngine } from '../engine';
import { collectSnapshot, buildArchitectureGraph } from '../analyzer/repository';
import { formatJSON, formatMarkdown, formatSARIF, formatText, type OutputFormat, type CLIResult } from './format';
import { EXIT_CODES } from '../core/protocol';

export interface CLIContext {
  rootPath: string;
  format: OutputFormat;
  engine: EngineeringOSEngine;
}

export async function createCLIContext(rootPath: string, format: OutputFormat): Promise<CLIContext> {
  const engine = new EngineeringOSEngine(rootPath);
  return { rootPath, format, engine };
}

export async function cmdInit(ctx: CLIContext): Promise<CLIResult> {
  const initialized = await ctx.engine.isInitialized();
  if (initialized) {
    return { exitCode: 0, output: 'Already initialized.', format: ctx.format };
  }
  try {
    const state = await ctx.engine.loadState();
    if (state) {
      return { exitCode: 0, output: 'Model loaded from existing state.', format: ctx.format };
    }
  } catch { /* not initialized */ }
  return { exitCode: EXIT_CODES.CONFIG_FAILURE, output: 'Not initialized. Use VS Code extension to initialize first, or provide a config.', format: ctx.format };
}

export async function cmdAnalyze(ctx: CLIContext): Promise<CLIResult> {
  try {
    const snapshot = await collectSnapshot(ctx.rootPath);
    const graph = buildArchitectureGraph(snapshot);
    const data = {
      timestamp: snapshot.timestamp,
      commitSha: snapshot.commitSha,
      stats: snapshot.stats,
      modules: graph.modules.length,
      dataStores: graph.data.length,
      contracts: graph.contracts.length,
      workflows: graph.workflows.length,
      security: snapshot.security.length,
      ownership: graph.ownership.length,
      infrastructure: graph.infrastructure.length,
      edges: graph.edges.length
    };

    switch (ctx.format) {
      case 'json': return { exitCode: 0, output: formatJSON(data), format: ctx.format };
      case 'markdown': return { exitCode: 0, output: formatMarkdown([
        '# Repository Analysis', '',
        `**Files:** ${snapshot.stats.totalFiles}`,
        `**Languages:** ${Object.entries(snapshot.stats.languages).map(([k, v]) => `${k} (${v})`).join(', ')}`,
        `**Modules:** ${graph.modules.length}`,
        `**Data stores:** ${graph.data.length}`,
        `**Contracts:** ${graph.contracts.length}`,
        `**Security findings:** ${snapshot.security.length}`,
      ]), format: ctx.format };
      default: return { exitCode: 0, output: formatText(
        `Analyzed: ${snapshot.stats.totalFiles} files, ${graph.modules.length} modules, ${snapshot.security.length} security findings`,
        [`Languages: ${Object.entries(snapshot.stats.languages).map(([k, v]) => `${k}(${v})`).join(' ')}`]
      ), format: ctx.format };
    }
  } catch (err) {
    return { exitCode: EXIT_CODES.CONFIG_FAILURE, output: `Analysis failed: ${err instanceof Error ? err.message : String(err)}`, format: ctx.format };
  }
}

export async function cmdValidate(ctx: CLIContext): Promise<CLIResult> {
  try {
    const execResult = await ctx.engine.runExecutableGuardrails();
    const sarifResults = execResult.violations.map(v => ({
      ruleId: v.ruleId,
      level: v.severity === 'BLOCKING' ? 'error' : v.severity === 'WARNING' ? 'warning' : 'note',
      message: v.message,
      file: v.file,
      line: v.line
    }));

    switch (ctx.format) {
      case 'json': return { exitCode: execResult.overall === 'BLOCK' ? EXIT_CODES.BLOCK : EXIT_CODES.PASS, output: formatJSON({ overall: execResult.overall, violations: execResult.violations, results: execResult.results }), format: ctx.format };
      case 'sarif': return { exitCode: execResult.overall === 'BLOCK' ? EXIT_CODES.BLOCK : EXIT_CODES.PASS, output: formatSARIF(sarifResults), format: ctx.format };
      case 'markdown': return { exitCode: execResult.overall === 'BLOCK' ? EXIT_CODES.BLOCK : EXIT_CODES.PASS, output: formatMarkdown([
        '# Validation Results', '', `**Overall:** ${execResult.overall}`, `**Violations:** ${execResult.violations.length}`, '',
        ...execResult.violations.map(v => `- **${v.severity}** [${v.ruleId}] ${v.message}${v.file ? ` at ${v.file}:${v.line}` : ''}`)
      ]), format: ctx.format };
      default: return { exitCode: execResult.overall === 'BLOCK' ? EXIT_CODES.BLOCK : EXIT_CODES.PASS, output: formatText(
        `Validation: ${execResult.overall} (${execResult.violations.length} violations)`,
        execResult.violations.map(v => `[${v.severity}] ${v.ruleId}: ${v.message}`)
      ), format: ctx.format };
    }
  } catch (err) {
    return { exitCode: EXIT_CODES.CONFIG_FAILURE, output: `Validation failed: ${err instanceof Error ? err.message : String(err)}`, format: ctx.format };
  }
}

export async function cmdHealth(ctx: CLIContext): Promise<CLIResult> {
  try {
    const report = await ctx.engine.computeHealthScore();

    switch (ctx.format) {
      case 'json': return { exitCode: EXIT_CODES.PASS, output: formatJSON(report), format: ctx.format };
      case 'markdown': return { exitCode: EXIT_CODES.PASS, output: formatMarkdown([
        '# Health Report', '', `**Score:** ${(report.overall * 100).toFixed(0)}% (${report.grade})`, '',
        '## Dimensions', '',
        ...report.dimensions.map(d => `- **${d.name}** (${(d.weight * 100).toFixed(0)}%): ${(d.score * 100).toFixed(0)}%`),
        '',
        ...(report.recommendations.length > 0 ? ['## Recommendations', '', ...report.recommendations.map(r => `- **${r.priority}** ${r.message}`)] : [])
      ]), format: ctx.format };
      default: return { exitCode: EXIT_CODES.PASS, output: formatText(
        `Health: ${(report.overall * 100).toFixed(0)}% (${report.grade})`,
        report.dimensions.map(d => `${d.name}: ${(d.score * 100).toFixed(0)}%`)
      ), format: ctx.format };
    }
  } catch (err) {
    return { exitCode: EXIT_CODES.CONFIG_FAILURE, output: `Health check failed: ${err instanceof Error ? err.message : String(err)}`, format: ctx.format };
  }
}

export async function cmdContext(ctx: CLIContext, task: string): Promise<CLIResult> {
  try {
    const result = await ctx.engine.prepareContext(task);
    switch (ctx.format) {
      case 'json': return { exitCode: 0, output: formatJSON(result), format: ctx.format };
      case 'markdown': return { exitCode: 0, output: result.serialized, format: ctx.format };
      default: return { exitCode: 0, output: formatText(`Context prepared (${result.summary.contains.length} sections, ~${result.package.estimatedTokens} tokens)`, []), format: ctx.format };
    }
  } catch (err) {
    return { exitCode: EXIT_CODES.CONFIG_FAILURE, output: `Context preparation failed: ${err instanceof Error ? err.message : String(err)}`, format: ctx.format };
  }
}

export async function cmdDrift(ctx: CLIContext): Promise<CLIResult> {
  try {
    const snapshot = await collectSnapshot(ctx.rootPath);
    const state = await ctx.engine.loadState();

    const files = snapshot.files.map(f => f.path);
    const { detectDrift } = await import('../drift/engine');
    const drift = detectDrift({
      map: state?.map ?? { project: { id: '', name: '', purpose: '' }, components: [], relationships: [], requirements: [], workflows: [], actors: [], dataFlows: [], environments: [], infrastructure: [] } as any,
      mentalModel: state?.mentalModel ?? { systemUnderstanding: { purpose: '', primaryUsers: [], criticalCapabilities: [] }, businessRules: [], invariants: [], decisions: [], risks: [], unknowns: [], assumptions: [], constraints: [], failureModes: [], recoveryStrategies: [] } as any,
      files,
      guardrailResults: []
    });

    switch (ctx.format) {
      case 'json': return { exitCode: drift.findings.length > 0 ? EXIT_CODES.WARN : EXIT_CODES.PASS, output: formatJSON(drift), format: ctx.format };
      case 'markdown': return { exitCode: drift.findings.length > 0 ? EXIT_CODES.WARN : EXIT_CODES.PASS, output: formatMarkdown([
        '# Drift Report', '', `**Findings:** ${drift.findings.length}`, '',
        ...drift.findings.map(f => `- **${f.driftType}** [${f.severity}] ${f.title}${f.evidence.length > 0 ? ` | ${f.evidence.join(', ')}` : ''}`)
      ]), format: ctx.format };
      default: return { exitCode: drift.findings.length > 0 ? EXIT_CODES.WARN : EXIT_CODES.PASS, output: formatText(
        `Drift: ${drift.findings.length} finding(s)`,
        drift.findings.map(f => `[${f.severity}] ${f.driftType}: ${f.title}`)
      ), format: ctx.format };
    }
  } catch (err) {
    return { exitCode: EXIT_CODES.CONFIG_FAILURE, output: `Drift check failed: ${err instanceof Error ? err.message : String(err)}`, format: ctx.format };
  }
}

export async function cmdReport(ctx: CLIContext): Promise<CLIResult> {
  try {
    const [validation, health, snapshot] = await Promise.all([
      ctx.engine.runExecutableGuardrails(),
      ctx.engine.computeHealthScore(),
      collectSnapshot(ctx.rootPath)
    ]);

    const report = {
      timestamp: new Date().toISOString(),
      commitSha: snapshot.commitSha,
      validation: { overall: validation.overall, violations: validation.violations.length },
      health: { score: health.overall, grade: health.grade },
      repository: { files: snapshot.stats.totalFiles, languages: snapshot.stats.languages, tests: snapshot.stats.testFiles },
      exitCode: validation.overall === 'BLOCK' ? EXIT_CODES.BLOCK : EXIT_CODES.PASS
    };

    switch (ctx.format) {
      case 'json': return { exitCode: report.exitCode, output: formatJSON(report), format: ctx.format };
      case 'sarif': return { exitCode: report.exitCode, output: formatSARIF(validation.violations.map(v => ({
        ruleId: v.ruleId, level: v.severity === 'BLOCKING' ? 'error' : 'warning', message: v.message, file: v.file, line: v.line
      }))), format: ctx.format };
      case 'markdown': return { exitCode: report.exitCode, output: formatMarkdown([
        '# EngineeringOS Report', '',
        `**Commit:** ${snapshot.commitSha ?? 'N/A'}`,
        `**Validation:** ${validation.overall} (${validation.violations.length} violations)`,
        `**Health:** ${(health.overall * 100).toFixed(0)}% (${health.grade})`,
        `**Repository:** ${snapshot.stats.totalFiles} files, ${snapshot.stats.testFiles} tests`,
        '',
        ...health.recommendations.slice(0, 5).map(r => `- **${r.priority}** ${r.message}`)
      ]), format: ctx.format };
      default: return { exitCode: report.exitCode, output: formatText(
        `Report: Validation=${validation.overall}, Health=${health.grade} (${(health.overall * 100).toFixed(0)}%), Files=${snapshot.stats.totalFiles}`,
        health.recommendations.slice(0, 3).map(r => `${r.priority}: ${r.message}`)
      ), format: ctx.format };
    }
  } catch (err) {
    return { exitCode: EXIT_CODES.CONFIG_FAILURE, output: `Report failed: ${err instanceof Error ? err.message : String(err)}`, format: ctx.format };
  }
}
