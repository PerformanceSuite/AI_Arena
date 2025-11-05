import { describe, it, expect } from 'vitest';
import { getProvider, getAllProviders, configureProviders } from './index';
import type { ArenaConfig } from '../util/config';

describe('Provider Registry', () => {
  it('gets provider by name', () => {
    const provider = getProvider('openai');
    expect(provider.name).toBe('openai');
  });

  it('throws error for unknown provider', () => {
    expect(() => getProvider('unknown')).toThrow('Unknown provider');
  });

  it('returns all registered providers', () => {
    const providers = getAllProviders();
    const names = providers.map(p => p.name);

    expect(names).toContain('openai');
    expect(names).toContain('anthropic');
    expect(names).toContain('google');
    expect(names).toContain('local');
  });

  it('configures all providers from config', async () => {
    const config: ArenaConfig = {
      providers: {
        openai: { apiKey: 'test-openai', models: [] },
        anthropic: { apiKey: 'test-anthropic', models: [] }
      }
    };

    await configureProviders(config);

    // Should not throw
    const openai = getProvider('openai');
    const anthropic = getProvider('anthropic');

    expect(openai).toBeDefined();
    expect(anthropic).toBeDefined();
  });
});
