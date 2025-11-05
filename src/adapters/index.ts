import type { ProviderAdapter } from './types';
import type { ArenaConfig } from '../util/config';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { GoogleAdapter } from './google';
import { LocalAdapter } from './local';

const registry = new Map<string, ProviderAdapter>();

// Register all providers
registry.set('openai', new OpenAIAdapter());
registry.set('anthropic', new AnthropicAdapter());
registry.set('google', new GoogleAdapter());
registry.set('local', new LocalAdapter());

/**
 * Get provider adapter by name
 */
export function getProvider(name: string): ProviderAdapter {
  const provider = registry.get(name);
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return provider;
}

/**
 * Get all registered providers
 */
export function getAllProviders(): ProviderAdapter[] {
  return Array.from(registry.values());
}

/**
 * Configure all providers from config
 */
export async function configureProviders(config: ArenaConfig): Promise<void> {
  const promises = Object.entries(config.providers).map(async ([name, cfg]) => {
    try {
      const provider = getProvider(name);
      await provider.configure(cfg);
    } catch (error) {
      console.warn(`Failed to configure provider ${name}:`, error);
    }
  });

  await Promise.all(promises);
}

// Re-export types
export type { ProviderAdapter, ChatArgs, ChatResult } from './types';
