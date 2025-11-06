import type { ProviderAdapter } from './types';

/**
 * Registry interface for managing provider adapters
 */
export interface ProviderRegistry {
  getAdapter(provider: string): ProviderAdapter;
}

/**
 * Default implementation of ProviderRegistry
 */
export class DefaultProviderRegistry implements ProviderRegistry {
  private registry = new Map<string, ProviderAdapter>();

  constructor() {
    // Providers can be registered via registerProvider method
  }

  /**
   * Register a provider adapter
   */
  registerProvider(name: string, adapter: ProviderAdapter): void {
    this.registry.set(name, adapter);
  }

  /**
   * Get provider adapter by name
   */
  getAdapter(name: string): ProviderAdapter {
    const provider = this.registry.get(name);
    if (!provider) {
      throw new Error(`Unknown provider: ${name}`);
    }
    return provider;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): ProviderAdapter[] {
    return Array.from(this.registry.values());
  }
}
