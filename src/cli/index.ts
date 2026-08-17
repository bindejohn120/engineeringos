#!/usr/bin/env node
import * as path from 'path';
import { createCLIContext, cmdInit, cmdAnalyze, cmdValidate, cmdHealth, cmdContext, cmdDrift, cmdReport } from './commands';
import type { OutputFormat } from './format';
import { EXIT_CODES } from '../core/protocol';

const HELP = `
EngineeringOS CLI v2.0.0 — Machine-assisted engineering control plane

Usage: engineeringos <command> [options]

Commands:
  init                    Check initialization status
  analyze                 Analyze repository structure
  validate                Run executable guardrails
  health                  Compute health score
  context --task "..."    Generate agent context for a task
  drift                   Check for model drift
  report                  Full report (validation + health + repository)
  help                    Show this help

Options:
  --format <fmt>          Output format: json, markdown, sarif, text (default: text)
  --root <path>           Workspace root (default: cwd)
  --task <text>           Task description (for context command)

Exit codes:
  0  PASS
  1  WARN or REVIEW
  2  BLOCKING violation
  3  Configuration or analysis failure
  4  NOT_VALIDATED (missing evidence)
`;

function parseArgs(argv: string[]): { command: string; format: OutputFormat; root: string; task: string } {
  const args = argv.slice(2);
  let command = 'help';
  let format: OutputFormat = 'text';
  let root = process.cwd();
  let task = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--format' && args[i + 1]) {
      format = args[++i] as OutputFormat;
    } else if (arg === '--root' && args[i + 1]) {
      root = path.resolve(args[++i]);
    } else if (arg === '--task' && args[i + 1]) {
      task = args[++i];
    } else if (!arg.startsWith('--')) {
      command = arg;
    }
  }

  return { command, format, root, task };
}

async function main(): Promise<void> {
  const { command, format, root, task } = parseArgs(process.argv);

  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    process.exit(0);
  }

  const ctx = await createCLIContext(root, format);
  let result;

  switch (command) {
    case 'init': result = await cmdInit(ctx); break;
    case 'analyze': result = await cmdAnalyze(ctx); break;
    case 'validate': result = await cmdValidate(ctx); break;
    case 'health': result = await cmdHealth(ctx); break;
    case 'context':
      if (!task) { result = { exitCode: EXIT_CODES.CONFIG_FAILURE, output: 'Error: --task is required for context command', format }; break; }
      result = await cmdContext(ctx, task);
      break;
    case 'drift': result = await cmdDrift(ctx); break;
    case 'report': result = await cmdReport(ctx); break;
    default: result = { exitCode: EXIT_CODES.CONFIG_FAILURE, output: `Unknown command: ${command}. Run "engineeringos help" for usage.`, format };
  }

  console.log(result.output);
  process.exit(result.exitCode);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(EXIT_CODES.CONFIG_FAILURE);
});
