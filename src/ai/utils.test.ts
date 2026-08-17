import { describe, it, expect } from 'vitest';
import { parseJsonObject } from './utils';

describe('parseJsonObject', () => {
  it('parses valid JSON', () => {
    const input = '{"key": "value", "num": 42}';
    const result = parseJsonObject(input);
    expect(result).toEqual({ key: 'value', num: 42 });
  });

  it('strips markdown code fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = parseJsonObject(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('strips code fences without language tag', () => {
    const input = '```\n{"a": 1}\n```';
    const result = parseJsonObject(input);
    expect(result).toEqual({ a: 1 });
  });

  it('extracts JSON from mixed text', () => {
    const input = 'Here is the result: {"foo": "bar"} hope that helps!';
    const result = parseJsonObject(input);
    expect(result).toEqual({ foo: 'bar' });
  });

  it('extracts JSON when surrounded by commentary', () => {
    const input = 'Sure, I can help.\n{"nested": true}\nLet me know.';
    const result = parseJsonObject(input);
    expect(result).toEqual({ nested: true });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseJsonObject('not json at all')).toThrow('AI response was not valid JSON');
  });

  it('throws on empty string', () => {
    expect(() => parseJsonObject('')).toThrow('AI response was not valid JSON');
  });

  it('parses nested JSON objects', () => {
    const input = '{"outer": {"inner": [1, 2, 3]}}';
    const result = parseJsonObject(input) as Record<string, unknown>;
    expect(result).toEqual({ outer: { inner: [1, 2, 3] } });
  });
});
