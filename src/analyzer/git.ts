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

export interface WorktreeInfo {
  path: string;
  branch: string;
  HEAD: string;
  bare: boolean;
  locked: boolean;
}

export async function listWorktrees(cwd: string): Promise<WorktreeInfo[]> {
  const raw = await runGit(cwd, ['worktree', 'list', '--porcelain']);
  if (!raw) return [];
  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};
  for (const line of raw.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) worktrees.push(current as WorktreeInfo);
      current = { path: line.slice('worktree '.length) };
    } else if (line.startsWith('HEAD ')) {
      current.HEAD = line.slice('HEAD '.length);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length);
    } else if (line.startsWith('bare')) {
      current.bare = true;
    } else if (line.startsWith('locked')) {
      current.locked = true;
    } else if (line === '') {
      if (current.path) worktrees.push(current as WorktreeInfo);
      current = {};
    }
  }
  if (current.path) worktrees.push(current as WorktreeInfo);
  return worktrees;
}

export async function createWorktree(cwd: string, branch: string, worktreePath: string): Promise<boolean> {
  const result = await runGit(cwd, ['worktree', 'add', '-b', branch, worktreePath, 'HEAD']);
  return result !== null;
}

export async function removeWorktree(cwd: string, worktreePath: string): Promise<boolean> {
  const result = await runGit(cwd, ['worktree', 'remove', worktreePath, '--force']);
  return result !== null;
}

export async function isWorktreeClean(cwd: string): Promise<boolean> {
  const raw = await runGit(cwd, ['status', '--porcelain']);
  return raw === '';
}

export async function ensureCleanBaseline(cwd: string): Promise<{ clean: boolean; reason?: string }> {
  const isClean = await isWorktreeClean(cwd);
  if (!isClean) {
    const state = await getGitState(cwd);
    return { clean: false, reason: `Working directory has ${state.changedFiles.length} uncommitted change(s). Commit or stash before starting work.` };
  }
  return { clean: true };
}
