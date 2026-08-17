import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import {
  safeParseBlueprint,
  safeParseConfig,
  safeParseGuardrails,
  safeParseMap,
  safeParseMentalModel
} from '../core/schemas';
import type {
  Blueprint,
  ConfigLike,
  Guardrails,
  Map,
  MentalModel
} from '../core/types';
import { resolvePaths, type EngineeringOSPaths } from './paths';

export interface SaveResult<T> {
  saved: boolean;
  artifact: T;
  snapshotWritten: boolean;
  error?: string;
}

export interface RepositoryState {
  config?: ConfigLike;
  map?: Map;
  mentalModel?: MentalModel;
  guardrails?: Guardrails;
  blueprint?: Blueprint;
}

export class EngineeringOSRepository {
  readonly paths: EngineeringOSPaths;

  constructor(readonly workspacePath: string) {
    this.paths = resolvePaths(workspacePath);
  }

  async ensureLayout(): Promise<void> {
    const dirs = [
      this.paths.root,
      this.paths.generated,
      this.paths.contexts,
      this.paths.decisions,
      this.paths.snapshots,
      this.paths.sessions,
      this.paths.evidence
    ];
    for (const dir of dirs) {
      await fsp.mkdir(dir, { recursive: true });
    }
  }

  async isInitialized(): Promise<boolean> {
    try {
      await fsp.access(this.paths.config, fs.constants.F_OK);
      await fsp.access(this.paths.map, fs.constants.F_OK);
      await fsp.access(this.paths.mentalModel, fs.constants.F_OK);
      await fsp.access(this.paths.guardrails, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async loadState(): Promise<RepositoryState> {
    const [config, map, mentalModel, guardrails] = await Promise.all([
      this.loadConfig(),
      this.loadMap(),
      this.loadMentalModel(),
      this.loadGuardrails()
    ]);
    return { config: config ?? undefined, map: map ?? undefined, mentalModel: mentalModel ?? undefined, guardrails: guardrails ?? undefined };
  }

  async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const raw = await fsp.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    await fsp.mkdir(dir, { recursive: true });
    const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    const payload = JSON.stringify(data, null, 2);
    await fsp.writeFile(tmp, payload, 'utf-8');
    await fsp.rename(tmp, filePath);
  }

  async loadConfig(): Promise<ConfigLike | null> {
    const raw = await this.readJson<unknown>(this.paths.config);
    if (raw === null) return null;
    const parsed = safeParseConfig(raw);
    return parsed.ok ? parsed.data : null;
  }

  async saveConfig(config: ConfigLike): Promise<SaveResult<ConfigLike>> {
    await this.ensureLayout();
    const stamped: ConfigLike = {
      ...config,
      updatedAt: new Date().toISOString()
    };
    await this.writeJsonAtomic(this.paths.config, stamped);
    return { saved: true, artifact: stamped, snapshotWritten: false };
  }

  async loadMap(): Promise<Map | null> {
    const raw = await this.readJson<unknown>(this.paths.map);
    if (raw === null) return null;
    const parsed = safeParseMap(raw);
    return parsed.ok ? (parsed.data as unknown as Map) : null;
  }

  async loadMentalModel(): Promise<MentalModel | null> {
    const raw = await this.readJson<unknown>(this.paths.mentalModel);
    if (raw === null) return null;
    const parsed = safeParseMentalModel(raw);
    return parsed.ok ? (parsed.data as unknown as MentalModel) : null;
  }

  async loadGuardrails(): Promise<Guardrails | null> {
    const raw = await this.readJson<unknown>(this.paths.guardrails);
    if (raw === null) return null;
    const parsed = safeParseGuardrails(raw);
    return parsed.ok ? (parsed.data as unknown as Guardrails) : null;
  }

  async loadBlueprint(): Promise<Blueprint | null> {
    const raw = await this.readJson<unknown>(this.paths.blueprint);
    if (raw === null) return null;
    const parsed = safeParseBlueprint(raw);
    return parsed.ok ? (parsed.data as unknown as Blueprint) : null;
  }

  async saveBlueprint(blueprint: Blueprint, basedOnCommit?: string | null): Promise<SaveResult<Blueprint>> {
    return this.saveArtifact('blueprint', blueprint, basedOnCommit);
  }

  async saveMap(map: Map, basedOnCommit?: string | null): Promise<SaveResult<Map>> {
    return this.saveArtifact('map', map, basedOnCommit);
  }

  async saveMentalModel(model: MentalModel, basedOnCommit?: string | null): Promise<SaveResult<MentalModel>> {
    return this.saveArtifact('mental-model', model, basedOnCommit);
  }

  async saveGuardrails(guardrails: Guardrails, basedOnCommit?: string | null): Promise<SaveResult<Guardrails>> {
    return this.saveArtifact('guardrails', guardrails, basedOnCommit);
  }

  private async saveArtifact<T extends { modelVersion: number; updatedAt?: string; basedOnCommit?: string | null; schemaVersion: string }>(
    kind: 'map' | 'mental-model' | 'guardrails' | 'blueprint',
    artifact: T,
    basedOnCommit?: string | null
  ): Promise<SaveResult<T>> {
    await this.ensureLayout();
    const filePath =
      kind === 'map' ? this.paths.map :
      kind === 'mental-model' ? this.paths.mentalModel :
      kind === 'blueprint' ? this.paths.blueprint :
      this.paths.guardrails;

    const previous = await this.readJson<T | null>(filePath);
    let snapshotWritten = false;

    if (previous && previous.modelVersion > 0) {
      snapshotWritten = await this.writeSnapshot(kind, previous);
    }

    const nextVersion = (previous?.modelVersion ?? 0) + 1;
    const stamped: T = {
      ...artifact,
      schemaVersion: '1.0',
      modelVersion: nextVersion,
      updatedAt: new Date().toISOString(),
      basedOnCommit: basedOnCommit ?? previous?.basedOnCommit ?? null
    };

    await this.writeJsonAtomic(filePath, stamped);
    return { saved: true, artifact: stamped, snapshotWritten };
  }

  async writeSnapshot(kind: 'map' | 'mental-model' | 'guardrails' | 'blueprint', state: unknown): Promise<boolean> {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const name = `${kind}-v${(state as { modelVersion?: number }).modelVersion ?? 0}-${stamp}.json`;
      const target = path.join(this.paths.snapshots, name);
      await fsp.writeFile(target, JSON.stringify(state, null, 2), 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  async writeGenerated(relativePath: string, content: string): Promise<string> {
    await this.ensureLayout();
    const target = path.join(this.paths.generated, relativePath);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, content, 'utf-8');
    return target;
  }

  async writeContextPackage(filename: string, content: string): Promise<string> {
    await this.ensureLayout();
    const target = path.join(this.paths.contexts, filename);
    await fsp.writeFile(target, content, 'utf-8');
    return target;
  }

  async listSnapshots(): Promise<string[]> {
    try {
      const entries = await fsp.readdir(this.paths.snapshots);
      return entries.sort().reverse();
    } catch {
      return [];
    }
  }

  async reset(): Promise<void> {
    const files = [
      this.paths.config,
      this.paths.map,
      this.paths.mentalModel,
      this.paths.guardrails,
      this.paths.blueprint,
      this.paths.generatedMap,
      this.paths.generatedMentalModel,
      this.paths.generatedGuardrails,
      this.paths.generatedBlueprint
    ];
    for (const file of files) {
      try { await fsp.unlink(file); } catch { /* ignore */ }
    }
    const dirs = [this.paths.snapshots, this.paths.contexts, this.paths.decisions, this.paths.sessions, this.paths.evidence];
    for (const dir of dirs) {
      try { await fsp.rm(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}
