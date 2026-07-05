import { describe, it, expect } from 'vitest';
import { generateSkillMarkdown } from '@/services/mcp/skills';
import { getMcpRegistry } from '@/services/mcp/tools';

describe('generateSkillMarkdown', () => {
  const markdown = generateSkillMarkdown('https://example.test');

  it('starts with SKILL.md frontmatter', () => {
    expect(markdown.startsWith('---\nname: radix-community-web\n')).toBe(true);
    expect(markdown).toContain('description:');
  });

  it('documents the endpoint of the requesting origin', () => {
    expect(markdown).toContain('https://example.test/api/mcp');
  });

  it('documents every registered tool with its parameters', () => {
    for (const tool of getMcpRegistry().list()) {
      expect(markdown).toContain(`### \`${tool.name}\``);
    }
    // Parameter lines come from the zod schemas
    expect(markdown).toContain('- `docId`');
    expect(markdown).toContain('"mainnet" | "stokenet"');
  });
});
