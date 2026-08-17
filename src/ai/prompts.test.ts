import { describe, it, expect } from 'vitest';
import {
  buildDomainModelPrompt,
  buildMentalModelPrompt,
  buildGuardrailsPrompt,
  buildThreatModelPrompt,
} from './prompts';

describe('buildDomainModelPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildDomainModelPrompt({
      projectName: 'TestApp',
      purpose: 'A test application',
      primaryUsers: ['developers'],
      criticalCapabilities: ['auth', 'dashboard'],
    });
    expect(typeof result.system).toBe('string');
    expect(typeof result.user).toBe('string');
    expect(result.system.length).toBeGreaterThan(0);
    expect(result.user.length).toBeGreaterThan(0);
  });

  it('includes project name in user prompt', () => {
    const result = buildDomainModelPrompt({
      projectName: 'MyProject',
      purpose: 'Do things',
      primaryUsers: [],
      criticalCapabilities: [],
    });
    expect(result.user).toContain('MyProject');
  });
});

describe('buildMentalModelPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildMentalModelPrompt({
      projectName: 'TestApp',
      purpose: 'A test application',
      primaryUsers: ['users'],
      criticalCapabilities: ['payments'],
    });
    expect(typeof result.system).toBe('string');
    expect(typeof result.user).toBe('string');
    expect(result.system.length).toBeGreaterThan(0);
    expect(result.user.length).toBeGreaterThan(0);
  });

  it('includes project name in user prompt', () => {
    const result = buildMentalModelPrompt({
      projectName: 'AcmePlatform',
      purpose: 'Platform',
      primaryUsers: [],
      criticalCapabilities: [],
    });
    expect(result.user).toContain('AcmePlatform');
  });
});

describe('buildGuardrailsPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildGuardrailsPrompt({
      projectName: 'TestApp',
      purpose: 'A test application',
    });
    expect(typeof result.system).toBe('string');
    expect(typeof result.user).toBe('string');
    expect(result.system.length).toBeGreaterThan(0);
    expect(result.user.length).toBeGreaterThan(0);
  });

  it('includes project name in user prompt', () => {
    const result = buildGuardrailsPrompt({
      projectName: 'GuardApp',
      purpose: 'Guard things',
    });
    expect(result.user).toContain('GuardApp');
  });
});

describe('buildThreatModelPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildThreatModelPrompt({
      projectName: 'TestApp',
      purpose: 'A test application',
    });
    expect(typeof result.system).toBe('string');
    expect(typeof result.user).toBe('string');
    expect(result.system.length).toBeGreaterThan(0);
    expect(result.user.length).toBeGreaterThan(0);
  });

  it('includes project name in user prompt', () => {
    const result = buildThreatModelPrompt({
      projectName: 'SecureApp',
      purpose: 'Be secure',
    });
    expect(result.user).toContain('SecureApp');
  });
});

describe('all prompts include project name', () => {
  const projectName = 'IntegrationTest';

  it('domain model prompt includes it', () => {
    const { user } = buildDomainModelPrompt({
      projectName,
      purpose: 'test',
      primaryUsers: [],
      criticalCapabilities: [],
    });
    expect(user).toContain(projectName);
  });

  it('mental model prompt includes it', () => {
    const { user } = buildMentalModelPrompt({
      projectName,
      purpose: 'test',
      primaryUsers: [],
      criticalCapabilities: [],
    });
    expect(user).toContain(projectName);
  });

  it('guardrails prompt includes it', () => {
    const { user } = buildGuardrailsPrompt({
      projectName,
      purpose: 'test',
    });
    expect(user).toContain(projectName);
  });

  it('threat model prompt includes it', () => {
    const { user } = buildThreatModelPrompt({
      projectName,
      purpose: 'test',
    });
    expect(user).toContain(projectName);
  });
});
