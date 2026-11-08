import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEnvFile, updateEnvFile } from '../src/ai/envConfig.ts';

describe('ai envConfig file operations', () => {
  it('parses and updates env files cleanly while preserving comments', () => {
    const tmp = join(mkdtempSync(join(tmpdir(), 'nc-env-test-')), '.env.local');
    writeFileSync(tmp, `# Header comment\nNC_AI_PROVIDER=openai\nOPENAI_API_KEY=test-key-123456\n# Another comment\nNC_AI_MODEL=model-a\n`, 'utf8');

    const parsed = parseEnvFile(tmp);
    expect(parsed.NC_AI_PROVIDER).toBe('openai');
    expect(parsed.OPENAI_API_KEY).toBe('test-key-123456');
    expect(parsed.NC_AI_MODEL).toBe('model-a');

    updateEnvFile(tmp, {
      NC_AI_MODEL: 'model-b',
      NC_AI_IMAGE_MODEL: 'image-model-1',
    });

    const updated = parseEnvFile(tmp);
    expect(updated.NC_AI_MODEL).toBe('model-b');
    expect(updated.NC_AI_IMAGE_MODEL).toBe('image-model-1');
    expect(updated.OPENAI_API_KEY).toBe('test-key-123456');

    const raw = readFileSync(tmp, 'utf8');
    expect(raw).toContain('# Header comment');
    expect(raw).toContain('# Another comment');
    expect(raw).toContain('NC_AI_MODEL=model-b');
    expect(raw).toContain('NC_AI_IMAGE_MODEL=image-model-1');
  });
});

