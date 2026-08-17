import { describe, it, expect } from 'vitest';
import {
  getWizardPhases,
  renderWizardPhaseHTML,
  renderWizardProgressHTML,
  renderWizardNavHTML,
} from './wizard';

describe('getWizardPhases', () => {
  it('returns all 5 phases', () => {
    const phases = getWizardPhases();
    expect(phases).toHaveLength(5);
  });

  it('has all 5 phase titles', () => {
    const phases = getWizardPhases();
    const titles = phases.map(p => p.title);
    expect(titles).toContain('Project Basics');
    expect(titles).toContain('Domain Model');
    expect(titles).toContain('Integrations');
    expect(titles).toContain('Non-Functional Requirements');
    expect(titles).toContain('Architecture & Stack');
  });

  it('each phase has required fields', () => {
    const phases = getWizardPhases();
    for (const phase of phases) {
      expect(typeof phase.id).toBe('string');
      expect(typeof phase.title).toBe('string');
      expect(typeof phase.description).toBe('string');
      expect(typeof phase.aiSuggestable).toBe('boolean');
      expect(Array.isArray(phase.fields)).toBe(true);
      expect(phase.fields.length).toBeGreaterThan(0);
    }
  });

  it('fields have required properties', () => {
    const phases = getWizardPhases();
    for (const phase of phases) {
      for (const field of phase.fields) {
        expect(typeof field.id).toBe('string');
        expect(typeof field.label).toBe('string');
        expect(['text', 'textarea', 'select', 'tags']).toContain(field.type);
      }
    }
  });
});

describe('renderWizardPhaseHTML', () => {
  it('returns HTML string containing phase title', () => {
    const phases = getWizardPhases();
    const html = renderWizardPhaseHTML(phases[0]);
    expect(typeof html).toBe('string');
    expect(html).toContain('<div');
    expect(html).toContain('Project Basics');
  });

  it('contains wizard fields for each phase', () => {
    const phases = getWizardPhases();
    for (const phase of phases) {
      const html = renderWizardPhaseHTML(phase);
      const escapedTitle = phase.title.replace(/&/g, '&amp;');
      expect(html).toContain(escapedTitle);
      for (const field of phase.fields) {
        expect(html).toContain(field.id);
      }
    }
  });

  it('renders text inputs', () => {
    const phases = getWizardPhases();
    const html = renderWizardPhaseHTML(phases[0]);
    expect(html).toContain('type="text"');
    expect(html).toContain('wz-projectName');
  });

  it('renders select inputs', () => {
    const phases = getWizardPhases();
    const html = renderWizardPhaseHTML(phases[2]);
    expect(html).toContain('<select');
  });

  it('renders tag inputs', () => {
    const phases = getWizardPhases();
    const html = renderWizardPhaseHTML(phases[0]);
    expect(html).toContain('data-type="tags"');
  });
});

describe('renderWizardProgressHTML', () => {
  it('returns HTML string with step indicator', () => {
    const html = renderWizardProgressHTML(0, 5);
    expect(typeof html).toBe('string');
    expect(html).toContain('Step 1 of 5');
  });
});

describe('renderWizardNavHTML', () => {
  it('returns HTML string with navigation buttons', () => {
    const html = renderWizardNavHTML(0, 5, false);
    expect(typeof html).toBe('string');
    expect(html).toContain('wz-next');
    expect(html).toContain('Next');
  });

  it('shows Previous button when not on first phase', () => {
    const html = renderWizardNavHTML(1, 5, false);
    expect(html).toContain('wz-prev');
    expect(html).toContain('Previous');
  });

  it('shows Build button on last phase', () => {
    const html = renderWizardNavHTML(4, 5, false);
    expect(html).toContain('wz-build');
    expect(html).toContain('Build My Engineering Model');
  });

  it('shows AI Suggest button when aiSuggestable', () => {
    const html = renderWizardNavHTML(1, 5, true);
    expect(html).toContain('wz-ai-suggest');
    expect(html).toContain('AI Suggest');
  });
});
