import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface GitState {
  isGit: boolean;
  currentCommit: string | null;
  changedFiles: string[];
  stagedFiles: string[];
  diff?: string;
  branch: string | null;
}

async function runGit(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: 16 * 1024 * 1024 });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function getGitState(cwd: string): Promise<GitState> {
  const base: GitState = {
    isGit: false,
    currentCommit: null,
    changedFiles: [],
    stagedFiles: [],
    branch: null
  };

  const root = await runGit(cwd, ['rev-parse', '--show-toplevel']);
  if (root === null) return base;

  base.isGit = true;
  base.currentCommit = await runGit(cwd, ['rev-parse', 'HEAD']);
  base.branch = await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);

  const changedRaw = await runGit(cwd, ['status', '--porcelain']);
  if (changedRaw !== null) {
    for (const line of changedRaw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const status = trimmed.slice(0, 2);
      const file = trimmed.slice(3);
      if (status.startsWith('??')) {
        base.changedFiles.push(file);
      } else if (status.includes('M') || status.includes('A') || status.includes('D') || status.includes('R') || status.includes('C')) {
        base.changedFiles.push(file);
      }
      if (status[0] !== ' ' && status[0] !== '?' && status[0] !== '!') {
        base.stagedFiles.push(file);
      }
    }
  }

  base.diff = (await runGit(cwd, ['diff', 'HEAD'])) ?? undefined;
  return base;
}

export async function getCurrentCommit(cwd: string): Promise<string | null> {
  return runGit(cwd, ['rev-parse', 'HEAD']);
}
