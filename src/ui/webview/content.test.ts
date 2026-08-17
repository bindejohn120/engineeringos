import { describe, it, expect } from 'vitest';
import { getWebviewContent } from '../webview/content';

describe('webview content', () => {
  it('produces an inline script with no syntax errors', () => {
    const html = getWebviewContent();
    const match = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const script = match?.[1] as string;
    expect(() => {
      const posted: unknown[] = [];
      const listeners: Record<string, (e: { data: unknown }) => void> = {};
      const elements: Record<string, { innerHTML: string; textContent: string; onclick: unknown }> = {};
      const makeEl = () => ({ innerHTML: '', textContent: '', onclick: null, classList: { add: () => undefined }, appendChild: () => undefined, querySelectorAll: () => [], addEventListener: () => undefined });
      const windowStub = { addEventListener: (type: string, fn: (e: { data: unknown }) => void) => { listeners[type] = fn; } };
      const documentStub = {
        getElementById: (id: string) => (elements[id] ??= makeEl()),
        createElement: () => makeEl()
      };
      const acquire = () => ({ postMessage: (msg: unknown) => posted.push(msg) });
      const wrapped = new Function('window', 'document', 'acquireVsCodeApi', 'console', script);
      wrapped(windowStub, documentStub, acquire, { log: () => undefined });
      expect(posted).toContainEqual({ type: 'ready' });
      const listener = listeners['message'];
      expect(listener).toBeDefined();
      listener({ data: { type: 'state', payload: { initialized: false } } });
      expect(elements['app'].innerHTML).toContain('card');
    }).not.toThrow();
  });

  it('renders the onboarding wizard when uninitialized', () => {
    const html = getWebviewContent();
    expect(html).toContain('Build My Engineering Model');
    expect(html).toContain('WIZARD_PHASES');
    expect(html).toContain('renderWizardPhase');
    expect(html).toContain('Project Basics');
    expect(html).toContain('Domain Model');
    expect(html).toContain('Integration Map');
  });
});
