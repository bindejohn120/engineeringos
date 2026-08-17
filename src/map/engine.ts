import type { Component, Map, Relationship, Workflow } from '../core/types';

export function createMap(projectName: string, projectId: string): Map {
  const now = new Date().toISOString();
  return {
    schemaVersion: '1.0',
    modelVersion: 0,
    updatedAt: now,
    basedOnCommit: null,
    project: { id: projectId, name: projectName },
    actors: [],
    requirements: [],
    components: [],
    services: [],
    dataStores: [],
    externalSystems: [],
    relationships: [],
    dataFlows: [],
    workflows: [],
    dependencies: [],
    environments: [],
    infrastructure: []
  };
}

export function addComponent(map: Map, component: Component): Map {
  const existing = map.components.find((c) => c.id === component.id);
  if (existing) {
    return {
      ...map,
      components: map.components.map((c) => (c.id === component.id ? component : c))
    };
  }
  return { ...map, components: [...map.components, component] };
}

export function addRelationship(map: Map, relationship: Relationship): Map {
  const existing = map.relationships.some((r) => r.id === relationship.id);
  if (existing) {
    return {
      ...map,
      relationships: map.relationships.map((r) => (r.id === relationship.id ? relationship : r))
    };
  }
  return { ...map, relationships: [...map.relationships, relationship] };
}

export function addWorkflow(map: Map, workflow: Workflow): Map {
  const existing = map.workflows.some((w) => w.id === workflow.id);
  if (existing) {
    return {
      ...map,
      workflows: map.workflows.map((w) => (w.id === workflow.id ? workflow : w))
    };
  }
  return { ...map, workflows: [...map.workflows, workflow] };
}

export function componentById(map: Map, id: string): Component | undefined {
  return map.components.find((c) => c.id === id);
}

export function dependentsOf(map: Map, componentId: string): string[] {
  return map.relationships
    .filter((r) => r.from === componentId || r.to === componentId)
    .map((r) => (r.from === componentId ? r.to : r.from));
}

export function sourceLocationsExist(files: string[], patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  for (const pattern of patterns) {
    for (const file of files) {
      const normPattern = pattern.replace(/\\/g, '/');
      const normFile = file.replace(/\\/g, '/');
      if (normPattern === normFile) return true;
      if (normPattern.endsWith('/**') && (normFile.startsWith(normPattern.slice(0, -3)) || normFile === normPattern.slice(0, -3))) {
        return true;
      }
      if (normPattern.includes('*') && matchesGlob(normFile, normPattern)) return true;
      if (!normPattern.includes('*') && normFile === normPattern) return true;
    }
  }
  return false;
}

function matchesGlob(file: string, pattern: string): boolean {
  return matchGlobParts(file.split('/'), pattern.split('/'));
}

function matchGlobParts(fileParts: string[], patternParts: string[]): boolean {
  if (patternParts.length === 0) return fileParts.length === 0;
  const head = patternParts[0];
  const rest = patternParts.slice(1);
  if (head === '**') {
    for (let i = 0; i <= fileParts.length; i++) {
      if (matchGlobParts(fileParts.slice(i), rest)) return true;
    }
    return false;
  }
  if (fileParts.length === 0) return false;
  const headMatches = head === '*' || head === fileParts[0] || (head.includes('*') && new RegExp(`^${head.split('*').map(escapeGlobPart).join('[^/]*')}$`).test(fileParts[0]));
  return headMatches && matchGlobParts(fileParts.slice(1), rest);
}

function escapeGlobPart(part: string): string {
  return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function unmappedSourceLocations(files: string[], map: Map): string[] {
  const covered = new Set<string>();
  const allPatterns = [
    ...map.components.flatMap((c) => c.sourceLocations),
    ...map.services.flatMap((s) => s.sourceLocations),
    ...map.dataStores.flatMap((d) => d.sourceLocations)
  ];
  for (const file of files) {
    for (const pattern of allPatterns) {
      const normPattern = pattern.replace(/\\/g, '/');
      if (normPattern.endsWith('/**')) {
        const prefix = normPattern.slice(0, -3);
        if (file === prefix || file.startsWith(prefix + '/')) {
          covered.add(file);
          break;
        }
      } else if (normPattern.includes('*')) {
        if (matchesGlob(file, normPattern)) {
          covered.add(file);
          break;
        }
      } else if (file === normPattern) {
        covered.add(file);
        break;
      }
    }
  }
  return files.filter((f) => !covered.has(f));
}
