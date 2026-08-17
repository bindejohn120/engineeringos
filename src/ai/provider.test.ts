import { describe, it, expect, vi } from 'vitest';
import { OpenAICompatibleClient } from './provider';
import { aiEnhanceBlueprint } from './blueprint';
import { buildBlueprint } from '../blueprint/engine';
import { safeParseBlueprint } from '../core/schemas';

function fakeFetch(payload: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({
    ok,
    status,
    text: async () => '',
    json: async () => payload
  }) as unknown as Response);
}

describe('AI provider', () => {
  it('is configured only when key and model exist', () => {
    const client = new OpenAICompatibleClient({ model: 'gpt-4o-mini', apiKey: '', fetchImpl: fakeFetch({}) });
    expect(client.isConfigured).toBe(false);
    const ready = new OpenAICompatibleClient({ model: 'gpt-4o-mini', apiKey: 'sk-test', fetchImpl: fakeFetch({}) });
    expect(ready.isConfigured).toBe(true);
  });

  it('posts a chat completion and returns the content', async () => {
    const fetchImpl = fakeFetch({ choices: [{ message: { content: 'Hello from the model' } }] });
    const client = new OpenAICompatibleClient({ model: 'gpt-4o-mini', apiKey: 'sk-test', fetchImpl });
    const out = await client.complete({ system: 'sys', user: 'usr' });
    expect(out).toBe('Hello from the model');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/chat/completions');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk-test' });
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages).toHaveLength(2);
  });

  it('does not send response_format for Claude models', async () => {
    const fetchImpl = fakeFetch({ choices: [{ message: { content: '{"ok":true}' } }] });
    const client = new OpenAICompatibleClient({ model: 'anthropic/claude-sonnet-4', apiKey: 'sk-or-v1-test', fetchImpl });
    await client.complete({ system: 's', user: 'u', jsonMode: true });
    const call = fetchImpl.mock.calls[0] as unknown as [string, { body: string }];
    const body = JSON.parse(call[1].body);
    expect(body.response_format).toBeUndefined();
  });

  it('sends response_format for OpenAI models', async () => {
    const fetchImpl = fakeFetch({ choices: [{ message: { content: '{"ok":true}' } }] });
    const client = new OpenAICompatibleClient({ model: 'gpt-4o-mini', apiKey: 'sk-test', fetchImpl });
    await client.complete({ system: 's', user: 'u', jsonMode: true });
    const call = fetchImpl.mock.calls[0] as unknown as [string, { body: string }];
    const body = JSON.parse(call[1].body);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('throws when the provider errors', async () => {
    const fetchImpl = fakeFetch({}, false, 401);
    const client = new OpenAICompatibleClient({ model: 'gpt-4o-mini', apiKey: 'sk-test', fetchImpl });
    await expect(client.complete({ system: 's', user: 'u' })).rejects.toThrow(/401/);
  });

  it('throws on empty content', async () => {
    const fetchImpl = fakeFetch({ choices: [{ message: { content: null } }] });
    const client = new OpenAICompatibleClient({ model: 'gpt-4o-mini', apiKey: 'sk-test', fetchImpl });
    await expect(client.complete({ system: 's', user: 'u' })).rejects.toThrow(/no content/);
  });
});

describe('AI blueprint enhancement', () => {
  const base = buildBlueprint({
    projectName: 'Yam Marketplace',
    projectId: 'yam-marketplace',
    purpose: 'Marketplace.',
    primaryUsers: ['farmers'],
    criticalCapabilities: ['listing', 'payment']
  });

  it('merges a schema-valid AI blueprint into the deterministic base', async () => {
    const aiSections = [
      { id: 'mission', title: 'Mission', purpose: 'Why', directives: ['D1', 'D2'] },
      { id: 'security', title: 'Security', purpose: 'How', directives: ['Audit everything'] }
    ];
    const fetchImpl = fakeFetch({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: 'AI-generated mission.',
            architectureStyle: 'microservices',
            techStack: { language: 'TypeScript', runtime: 'node', framework: 'NestJS', database: 'Postgres' },
            sections: aiSections
          })
        }
      }]
    });
    const client = new OpenAICompatibleClient({ model: 'm', apiKey: 'k', fetchImpl });
    const result = await aiEnhanceBlueprint(client, base, {
      projectName: 'Yam Marketplace',
      projectId: 'yam-marketplace',
      purpose: 'Marketplace.',
      primaryUsers: ['farmers'],
      criticalCapabilities: ['listing', 'payment']
    });

    expect(result.ai).toBe(true);
    expect(result.blueprint.architectureStyle).toBe('microservices');
    expect(result.blueprint.techStack.database).toBe('Postgres');
    expect(result.blueprint.summary).toContain('AI-generated');
    expect(result.blueprint.sections).toHaveLength(2);
    expect(safeParseBlueprint(result.blueprint).ok).toBe(true);
  });

  it('falls back to the deterministic blueprint on invalid AI JSON', async () => {
    const fetchImpl = fakeFetch({ choices: [{ message: { content: 'not json at all' } }] });
    const client = new OpenAICompatibleClient({ model: 'm', apiKey: 'k', fetchImpl });
    const result = await aiEnhanceBlueprint(client, base, {
      projectName: 'Yam Marketplace',
      projectId: 'yam-marketplace',
      purpose: 'Marketplace.',
      primaryUsers: ['farmers'],
      criticalCapabilities: ['listing', 'payment']
    });
    expect(result.ai).toBe(false);
    expect(result.blueprint.sections).toHaveLength(base.sections.length);
    expect(result.note).toMatch(/deterministic/);
  });

  it('returns the base unchanged when the client is not configured', async () => {
    const client = new OpenAICompatibleClient({ model: '', apiKey: '', fetchImpl: fakeFetch({}) });
    const result = await aiEnhanceBlueprint(client, base, {
      projectName: 'Yam Marketplace',
      projectId: 'yam-marketplace',
      purpose: 'Marketplace.',
      primaryUsers: ['farmers'],
      criticalCapabilities: ['listing', 'payment']
    });
    expect(result.ai).toBe(false);
    expect(result.blueprint).toBe(base);
  });
});
