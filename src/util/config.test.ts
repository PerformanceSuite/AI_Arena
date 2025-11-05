import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './config';
import { writeFileSync, unlinkSync } from 'fs';

describe('Config Loader', () => {
  const testConfigPath = 'test-arena.config.yaml';

  beforeEach(() => {
    // Set test env vars
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  afterEach(() => {
    try { unlinkSync(testConfigPath); } catch {}
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('loads config with env var substitution', () => {
    writeFileSync(testConfigPath, `
providers:
  openai:
    apiKey: \${OPENAI_API_KEY}
    models:
      - id: gpt-4o
  anthropic:
    apiKey: \${ANTHROPIC_API_KEY}
    models:
      - id: claude-3-5-sonnet-20241022
`);

    const config = loadConfig(testConfigPath);

    expect(config.providers.openai.apiKey).toBe('test-openai-key');
    expect(config.providers.anthropic.apiKey).toBe('test-anthropic-key');
    expect(config.providers.openai.models).toHaveLength(1);
  });

  it('throws error if required env var missing', () => {
    delete process.env.OPENAI_API_KEY;

    writeFileSync(testConfigPath, `
providers:
  openai:
    apiKey: \${OPENAI_API_KEY}
`);

    expect(() => loadConfig(testConfigPath)).toThrow('OPENAI_API_KEY');
  });

  it('uses default value when env var not set', () => {
    delete process.env.NATS_URL;

    writeFileSync(testConfigPath, `
providers:
  openai:
    apiKey: \${OPENAI_API_KEY}
    models:
      - id: gpt-4o
server:
  nats:
    url: \${NATS_URL:-nats://127.0.0.1:4222}
`);

    const config = loadConfig(testConfigPath);

    expect(config.server?.nats?.url).toBe('nats://127.0.0.1:4222');
    expect(config.providers.openai.apiKey).toBe('test-openai-key');
  });

  it('uses env var value when set, ignoring default', () => {
    process.env.NATS_URL = 'nats://custom:4222';

    writeFileSync(testConfigPath, `
providers:
  openai:
    apiKey: \${OPENAI_API_KEY}
    models:
      - id: gpt-4o
server:
  nats:
    url: \${NATS_URL:-nats://127.0.0.1:4222}
`);

    const config = loadConfig(testConfigPath);

    expect(config.server?.nats?.url).toBe('nats://custom:4222');

    delete process.env.NATS_URL;
  });
});
