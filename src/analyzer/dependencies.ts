import * as fsp from 'fs/promises';
import * as path from 'path';
import type { Dependency } from '../core/types';
import { slugify } from '../core/knowledge';

export interface PackageDependencies {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
}

export async function readPackageDependencies(workspacePath: string): Promise<PackageDependencies | null> {
  const pkgPath = path.join(workspacePath, 'package.json');
  try {
    const raw = await fsp.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    return {
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
      peerDependencies: pkg.peerDependencies ?? {}
    };
  } catch {
    return null;
  }
}

export async function readPackageDependencyList(workspacePath: string): Promise<Dependency[]> {
  const pkg = await readPackageDependencies(workspacePath);
  if (!pkg) return [];
  const out: Dependency[] = [];
  for (const [name, version] of Object.entries(pkg.dependencies)) {
    out.push({ id: slugify(name), name, type: 'runtime', version, critical: false });
  }
  for (const [name, version] of Object.entries(pkg.peerDependencies)) {
    out.push({ id: slugify(name), name, type: 'peer', version, critical: false });
  }
  for (const [name, version] of Object.entries(pkg.devDependencies)) {
    out.push({ id: slugify(name), name, type: 'dev', version, critical: false });
  }
  return out;
}
