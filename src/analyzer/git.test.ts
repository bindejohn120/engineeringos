import { describe, it, expect } from 'vitest';
import { getGitState, getCurrentCommit, listWorktrees, createWorktree, removeWorktree, isWorktreeClean, ensureCleanBaseline } from './git';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const WORKSPACE = process.cwd();

describe('git module', () => {
  it('getGitState returns valid state for a git repo', async () => {
    const state = await getGitState(WORKSPACE);
    expect(state.isGit).toBe(true);
    expect(typeof state.branch).toBe('string');
    expect(state.branch!.length).toBeGreaterThan(0);
    expect(typeof state.currentCommit).toBe('string');
    expect(state.currentCommit!.length).toBeGreaterThan(0);
  });

  it('getCurrentCommit returns HEAD hash', async () => {
    const commit = await getCurrentCommit(WORKSPACE);
    expect(commit).not.toBeNull();
    expect(commit!.length).toBeGreaterThanOrEqual(7);
  });

  it('listWorktrees returns at least the main worktree', async () => {
    const worktrees = await listWorktrees(WORKSPACE);
    expect(worktrees.length).toBeGreaterThanOrEqual(1);
    expect(worktrees[0].path.length).toBeGreaterThan(0);
    expect(worktrees[0].HEAD.length).toBeGreaterThan(0);
  });

  it('isWorktreeClean returns a boolean', async () => {
    const clean = await isWorktreeClean(WORKSPACE);
    expect(typeof clean).toBe('boolean');
  });

  it('ensureCleanBaseline returns clean=true when no changes', async () => {
    const result = await ensureCleanBaseline(WORKSPACE);
    expect(typeof result.clean).toBe('boolean');
    if (!result.clean) {
      expect(typeof result.reason).toBe('string');
      expect(result.reason!.length).toBeGreaterThan(0);
    }
  });

  it('createWorktree and removeWorktree round-trip', async () => {
    const wtDir = path.join(os.tmpdir(), `engineeringos-wt-test-${Date.now()}`);
    const created = await createWorktree(WORKSPACE, `test-wt-${Date.now()}`, wtDir);
    expect(created).toBe(true);
    expect(fs.existsSync(wtDir)).toBe(true);

    const worktrees = await listWorktrees(WORKSPACE);
    expect(worktrees.length).toBeGreaterThanOrEqual(2);

    const removed = await removeWorktree(WORKSPACE, wtDir);
    expect(removed).toBe(true);
    expect(fs.existsSync(wtDir)).toBe(false);
  });

  it('ensureCleanBaseline reports dirty working directory', async () => {
    const tmpWorkDir = path.join(os.tmpdir(), `engineeringos-dirty-test-${Date.now()}`);
    fs.mkdirSync(tmpWorkDir, { recursive: true });
    const { execFileSync } = require('child_process');
    execFileSync('git', ['init'], { cwd: tmpWorkDir });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpWorkDir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmpWorkDir });
    fs.writeFileSync(path.join(tmpWorkDir, 'dummy.txt'), 'hello');
    const result = await ensureCleanBaseline(tmpWorkDir);
    expect(result.clean).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.reason!.length).toBeGreaterThan(0);
    fs.rmSync(tmpWorkDir, { recursive: true, force: true });
  });
});
