import { z } from 'zod';
import type { Blueprint, BlueprintSection } from '../core/types';
import type { AIClient } from './provider';
import type { BlueprintSeedInput } from '../blueprint/engine';
import { parseJsonObject } from './utils';

const aiSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  purpose: z.string().default(''),
  directives: z.array(z.string()).default([])
});

const aiBlueprintSchema = z.object({
  summary: z.string().default(''),
  architectureStyle: z.string().default('layered'),
  techStack: z.object({
    language: z.string().default(''),
    runtime: z.string().default(''),
    framework: z.string().default(''),
    database: z.string().default('')
  }).default({}),
  sections: z.array(aiSectionSchema).default([])
});

export interface AIBlueprintResult {
  ai: boolean;
  blueprint: Blueprint;
  note?: string;
}

export async function aiEnhanceBlueprint(
  client: AIClient,
  base: Blueprint,
  input: BlueprintSeedInput
): Promise<AIBlueprintResult> {
  if (!client.isConfigured) return { ai: false, blueprint: base };

  const system = [
    'You are the chief architect of EngineeringOS. Produce a comprehensive engineering blueprint for the system described.',
    'Respond with STRICT JSON only, matching exactly:',
    JSON.stringify(
      {
        summary: 'one-paragraph engineering mission for the system',
        architectureStyle: 'recommended architecture style',
        techStack: { language: '', runtime: '', framework: '', database: '' },
        sections: [
          {
            id: 'kebab-case-id',
            title: 'Section Title',
            purpose: 'why this section exists',
            directives: ['concrete, actionable requirement the AI coding agent must follow', '...']
          }
        ]
      },
      null,
      2
    ),
    'Sections MUST cover at least: mission, system-context, architecture, module-boundaries, data, api-design, security, error-handling, observability, testing, performance, maintainability, cicd, verification, definition-of-done, roadmap.',
    'Directives MUST be specific, senior-engineer-grade, and actionable. Do not emit markdown, code fences, or commentary outside the JSON.'
  ].join('\n');

  const user = [
    `Project: ${input.projectName}`,
    `Purpose: ${input.purpose}`,
    `Primary users: ${input.primaryUsers.join(', ') || 'unspecified'}`,
    `Critical capabilities: ${input.criticalCapabilities.join(', ') || 'unspecified'}`,
    `Preferred architecture: ${input.options?.architectureStyle ?? 'any'}`,
    `Security level: ${input.options?.securityLevel ?? 'baseline'}`,
    `Stack hints: language=${input.options?.language ?? ''}, runtime=${input.options?.runtime ?? ''}, framework=${input.options?.framework ?? ''}, database=${input.options?.database ?? ''}`,
    input.options?.sourceSpec ? `Additional blueprint requirements from the user:\n${input.options.sourceSpec}` : '',
    'Generate the blueprint JSON now.'
  ].filter(Boolean).join('\n');

  try {
    const raw = await client.complete({ system, user, jsonMode: true, temperature: 0.3, maxTokens: 4096 });
    const parsed = parseJsonObject(raw);
    const result = aiBlueprintSchema.safeParse(parsed);
    if (!result.success) {
      return { ai: false, blueprint: base, note: 'AI response failed schema validation; used deterministic blueprint.' };
    }
    const ai = result.data;
    const sections: BlueprintSection[] = ai.sections.length > 0 ? ai.sections : base.sections;
    return {
      ai: true,
      blueprint: {
        ...base,
        summary: ai.summary || base.summary,
        architectureStyle: ai.architectureStyle || base.architectureStyle,
        techStack: {
          ...base.techStack,
          language: ai.techStack.language || base.techStack.language,
          runtime: ai.techStack.runtime || base.techStack.runtime,
          framework: ai.techStack.framework || base.techStack.framework,
          database: ai.techStack.database || base.techStack.database
        },
        sections
      }
    };
  } catch (err) {
    return {
      ai: false,
      blueprint: base,
      note: `AI generation failed (${err instanceof Error ? err.message : String(err)}); used deterministic blueprint.`
    };
  }
}
