import type { ConfigLike } from '../core/types';

export interface AICompletionInput {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface AIClient {
  readonly kind: string;
  readonly isConfigured: boolean;
  complete(input: AICompletionInput): Promise<string>;
}

export interface AIClientOptions {
  model: string;
  baseUrl?: string;
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export class OpenAICompatibleClient implements AIClient {
  readonly kind = 'openai';
  readonly isConfigured: boolean;

  constructor(private readonly options: AIClientOptions) {
    this.isConfigured = Boolean(options.apiKey && options.model);
  }

  async complete(input: AICompletionInput): Promise<string> {
    if (!this.isConfigured) throw new Error('AI client is not configured (missing API key or model).');

    const body: Record<string, unknown> = {
      model: this.options.model,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user }
      ],
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 2048
    };

    if (input.jsonMode && !this.options.model.includes('claude')) {
      body.response_format = { type: 'json_object' };
    }

    const fetchImpl = this.options.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 60_000);
    try {
      const response = await fetchImpl(`${this.options.baseUrl ?? OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.options.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`AI request failed (${response.status}): ${detail.slice(0, 300)}`);
      }
      const payload = (await response.json()) as {
        choices?: { message?: { content?: string | null } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error('AI response contained no content.');
      return content.trim();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createAIClient(config: ConfigLike, secretApiKey?: string): AIClient | null {
  const ai = config.ai;
  if (!ai || ai.provider === 'none' || ai.enabled === false) return null;

  const apiKey = secretApiKey || process.env[ai.apiKeyEnv || 'ENGINEERINGOS_AI_KEY'] || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const isOpenRouter = apiKey.startsWith('sk-or-') || ai.provider === 'openrouter';
  const baseUrl = ai.baseUrl || (isOpenRouter ? OPENROUTER_BASE_URL : ai.provider === 'openai' ? OPENAI_BASE_URL : undefined);
  const defaultModel = isOpenRouter ? 'anthropic/claude-sonnet-4' : ai.provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini';

  return new OpenAICompatibleClient({
    model: ai.model || defaultModel,
    baseUrl,
    apiKey
  });
}
