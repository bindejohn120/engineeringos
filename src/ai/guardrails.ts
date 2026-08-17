import type { AIClient } from './provider';
import type { Guardrail } from '../core/types';
import { buildGuardrailsPrompt } from './prompts';
import { AIGuardrailsOutputSchema } from './schemas';
import type { AIGuardrailsOutput } from './schemas';
import { parseJsonObject } from './utils';

export interface AIGuardrailsResult {
  ai: boolean;
  guardrails: Guardrail[];
}

const emptyResult: AIGuardrailsResult = {
  ai: false,
  guardrails: []
};

let guardrailCounter = 0;

export async function aiGenerateGuardrails(
  client: AIClient,
  input: {
    projectName: string;
    purpose: string;
    language?: string;
    framework?: string;
    database?: string;
    entities?: string[];
    compliance?: string[];
    securityLevel?: string;
  }
): Promise<AIGuardrailsResult> {
  if (!client.isConfigured) return emptyResult;

  try {
    const { system, user } = buildGuardrailsPrompt(input);
    const raw = await client.complete({ system, user, jsonMode: true, temperature: 0.2, maxTokens: 8192 });
    const obj = parseJsonObject(raw);
    const result = AIGuardrailsOutputSchema.safeParse(obj);
    if (!result.success) return emptyResult;
    const d = result.data as AIGuardrailsOutput;

    const guardrails: Guardrail[] = (d.guardrails ?? []).map((g: any) => {
      guardrailCounter++;
      const id = `GR-AI-${String(guardrailCounter).padStart(3, '0')}`;
      return {
        id,
        name: g.name ?? '',
        rule: g.rule ?? '',
        severity: g.severity ?? 'warning',
        scope: g.scope ?? [],
        allowedPatterns: g.allowedPatterns ?? [],
        forbiddenPatterns: g.forbiddenPatterns ?? [],
        enforcement: g.enforcement ?? [],
        reason: g.reason ?? '',
        verification: g.verification ?? []
      };
    });

    return { ai: true, guardrails };
  } catch {
    return emptyResult;
  }
}
