import type { AIClient } from './provider';
import { buildDomainModelPrompt } from './prompts';
import { AIDomainModelSchema } from './schemas';
import type { AIDomainModelOutput } from './schemas';
import { parseJsonObject } from './utils';

export interface AIDomainModelResult {
  ai: boolean;
  entities: Array<{
    name: string;
    description: string;
    properties: Array<{ name: string; type: string; required: boolean }>;
    relationships: Array<{ target: string; type: string; description: string }>;
  }>;
  relationships: Array<{ from: string; to: string; type: string; description: string }>;
  domainEvents: Array<{ name: string; description: string; trigger: string; steps: string[]; actors: string[]; payload: Record<string, string> }>;
  valueObjects: Array<{ name: string; properties: Array<{ name: string; type: string }> }>;
  boundedContexts: Array<{ name: string; description: string; entities: string[] }>;
}

const emptyResult: AIDomainModelResult = {
  ai: false,
  entities: [],
  relationships: [],
  domainEvents: [],
  valueObjects: [],
  boundedContexts: []
};

export async function aiGenerateDomainModel(
  client: AIClient,
  input: {
    projectName: string;
    purpose: string;
    primaryUsers: string[];
    criticalCapabilities: string[];
    architectureStyle?: string;
    language?: string;
    framework?: string;
    database?: string;
  }
): Promise<AIDomainModelResult> {
  if (!client.isConfigured) return emptyResult;

  try {
    const { system, user } = buildDomainModelPrompt(input);
    const raw = await client.complete({ system, user, jsonMode: true, temperature: 0.4, maxTokens: 8192 });
    const obj = parseJsonObject(raw);
    const result = AIDomainModelSchema.safeParse(obj);
    if (!result.success) return emptyResult;
    const d = result.data as AIDomainModelOutput;
    return {
      ai: true,
      entities: (d.entities ?? []).map((e: any) => ({
        name: e.name ?? '',
        description: e.description ?? '',
        properties: (e.properties ?? []).map((p: any) => ({ name: p.name ?? '', type: p.type ?? 'string', required: p.required ?? true })),
        relationships: (e.relationships ?? []).map((r: any) => ({ target: r.target ?? '', type: r.type ?? '', description: r.description ?? '' }))
      })),
      relationships: (d.relationships ?? []).map((r: any) => ({ from: r.from ?? '', to: r.to ?? '', type: r.type ?? '', description: r.description ?? '' })),
      domainEvents: (d.domainEvents ?? []).map((e: any) => ({
        name: e.name ?? '',
        description: e.description ?? '',
        trigger: e.trigger ?? '',
        steps: e.steps ?? [],
        actors: e.actors ?? [],
        payload: e.payload ?? {}
      })),
      valueObjects: (d.valueObjects ?? []).map((v: any) => ({
        name: v.name ?? '',
        properties: (v.properties ?? []).map((p: any) => ({ name: p.name ?? '', type: p.type ?? 'string' }))
      })),
      boundedContexts: (d.boundedContexts ?? []).map((b: any) => ({
        name: b.name ?? '',
        description: b.description ?? '',
        entities: b.entities ?? []
      }))
    };
  } catch {
    return emptyResult;
  }
}
