import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EngineeringOSRepository } from '../storage/repository';
import { fixtureMap, fixtureMentalModel, fixtureGuardrails, tmpDir } from '../test/helpers';
import * as fs from 'fs';

describe('repository', () => {
  let dir: string;
  let repo: EngineeringOSRepository;

  beforeEach(() => {
    dir = tmpDir();
    repo = new EngineeringOSRepository(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates the layout', async () => {
    await repo.ensureLayout();
    expect(fs.existsSync(repo.paths.root)).toBe(true);
    expect(fs.existsSync(repo.paths.generated)).toBe(true);
    expect(fs.existsSync(repo.paths.snapshots)).toBe(true);
  });

  it('reports not initialized before artifacts exist', async () => {
    expect(await repo.isInitialized()).toBe(false);
  });

  it('saves and loads map with version bump and snapshot', async () => {
    const map = fixtureMap();
    const first = await repo.saveMap(map, 'abc123');
    expect(first.saved).toBe(true);
    expect(first.artifact.modelVersion).toBe(1);
    expect(first.snapshotWritten).toBe(false);

    const second = await repo.saveMap(fixtureMap(), 'def456');
    expect(second.artifact.modelVersion).toBe(2);
    expect(second.snapshotWritten).toBe(true);
    expect(second.artifact.basedOnCommit).toBe('def456');

    const loaded = await repo.loadMap();
    expect(loaded?.modelVersion).toBe(2);
    expect(loaded?.project.name).toBe('Test App');

    const snapshots = await repo.listSnapshots();
    expect(snapshots.length).toBe(1);
  });

  it('returns null when map missing', async () => {
    expect(await repo.loadMap()).toBeNull();
  });

  it('ignores corrupt json', async () => {
    await repo.ensureLayout();
    fs.writeFileSync(repo.paths.map, '{not json', 'utf-8');
    expect(await repo.loadMap()).toBeNull();
  });

  it('saves mental model and guardrails', async () => {
    const model = fixtureMentalModel();
    const saved = await repo.saveMentalModel(model);
    expect(saved.artifact.modelVersion).toBe(1);

    const g = fixtureGuardrails();
    const savedG = await repo.saveGuardrails(g);
    expect(savedG.artifact.modelVersion).toBe(1);

    const loadedModel = await repo.loadMentalModel();
    expect(loadedModel?.systemUnderstanding.purpose).toContain('test marketplace');
    const loadedG = await repo.loadGuardrails();
    expect(loadedG?.guardrails.length).toBe(2);
  });

  it('writes generated markdown and context packages', async () => {
    const target = await repo.writeGenerated('map.md', '# Map');
    expect(fs.readFileSync(target, 'utf-8')).toBe('# Map');
    const ctx = await repo.writeContextPackage('current-task.json', '{}');
    expect(fs.readFileSync(ctx, 'utf-8')).toBe('{}');
  });

  it('saves config with updatedAt', async () => {
    const config = {
      schemaVersion: '1.0',
      projectId: 'p',
      projectName: 'P',
      workspacePath: dir,
      createdAt: 'now',
      updatedAt: 'then',
      analysis: { enabled: true, watchFiles: true, watchGit: true },
      ai: { provider: 'none', contextMode: 'minimal-relevant' }
    };
    const saved = await repo.saveConfig(config);
    expect(saved.artifact.updatedAt).not.toBe('then');
  });
});
