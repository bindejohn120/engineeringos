import type { AIClient } from './provider';
import type { Severity } from '../core/types';
import { buildThreatModelPrompt } from './prompts';
import { AIThreatModelSchema } from './schemas';
import type { AIThreatModelOutput } from './schemas';
import { parseJsonObject } from './utils';

export interface AIThreatModelResult {
  ai: boolean;
  threats: Array<{
    stride: string;
    threat: string;
    affectedComponent: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    mitigation: string;
  }>;
  attackSurface: string[];
  securityRequirements: Array<{
    text: string;
    severity: Severity;
  }>;
}

const emptyResult: AIThreatModelResult = {
  ai: false,
  threats: [],
  attackSurface: [],
  securityRequirements: []
};

export async function aiGenerateThreatModel(
  client: AIClient,
  input: {
    projectName: string;
    purpose: string;
    entities?: string[];
    integrations?: string[];
    compliance?: string[];
    securityLevel?: string;
  }
): Promise<AIThreatModelResult> {
  if (!client.isConfigured) return emptyResult;

  try {
    const { system, user } = buildThreatModelPrompt(input);
    const raw = await client.complete({ system, user, jsonMode: true, temperature: 0.3, maxTokens: 8192 });
    const obj = parseJsonObject(raw);
    const result = AIThreatModelSchema.safeParse(obj);
    if (!result.success) return emptyResult;
    const d = result.data as AIThreatModelOutput;
    return {
      ai: true,
      threats: (d.threats ?? []).map((t: any) => ({
        stride: t.stride ?? '',
        threat: t.threat ?? '',
        affectedComponent: t.affectedComponent ?? '',
        severity: t.severity ?? 'medium',
        mitigation: t.mitigation ?? ''
      })),
      attackSurface: d.attackSurface ?? [],
      securityRequirements: (d.securityRequirements ?? []).map((sr: any) => {
        if (typeof sr === 'string') {
          return { text: sr, severity: 'warning' as Severity };
        }
        return { text: sr.text ?? '', severity: sr.severity ?? 'warning' };
      })
    };
  } catch {
    return emptyResult;
  }
}
