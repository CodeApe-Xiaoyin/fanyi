import { describe, expect, it } from 'vitest';

import {
  extractJsonPath,
  renderTemplate,
  unknownToText,
} from '@/infrastructure/llm/provider-helpers';

describe('provider-helpers', () => {
  it('renders request templates with escaped strings and JSON messages', () => {
    const rendered = renderTemplate(
      '{ "input": "{{system}}\\n\\n{{lastUserMessage}}", "messages": {{messages}} }',
      {
        model: 'ignored',
        system: 'You are "Fanyi"',
        messages: [{ role: 'user', content: 'Hello\nworld' }],
      },
      'demo-model',
    );

    expect(rendered).toContain('You are \\"Fanyi\\"');
    expect(rendered).toContain('"messages": [{"role":"user","content":"Hello\\nworld"}]');
  });

  it('extracts nested values via JSONPath-like selectors', () => {
    const value = extractJsonPath(
      {
        data: {
          choices: [{ message: { content: 'done' } }],
        },
      },
      '$.data.choices[0].message.content',
    );

    expect(value).toBe('done');
  });

  it('converts unknown payloads into plain text', () => {
    expect(unknownToText(['foo', 'bar'])).toBe('foobar');
    expect(unknownToText({ ok: true })).toBe('{"ok":true}');
  });
});
