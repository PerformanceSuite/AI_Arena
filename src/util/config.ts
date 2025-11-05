import { readFileSync } from 'fs';
import yaml from 'yaml';

export interface ModelSpec {
  id: string;
  maxTokens?: number;
}

export interface ProviderConfig {
  apiKey: string;
  endpoint?: string;
  models: ModelSpec[];
}

export interface ArenaConfig {
  providers: Record<string, ProviderConfig>;
  server?: {
    http?: { port: number };
    nats?: { url: string };
  };
}

/**
 * Load arena.config.yaml with environment variable substitution
 */
export function loadConfig(path: string = 'arena.config.yaml'): ArenaConfig {
  const content = readFileSync(path, 'utf-8');

  // Substitute ${VAR} with process.env.VAR
  const substituted = content.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    const value = process.env[varName];
    if (!value) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
    return value;
  });

  const config = yaml.parse(substituted) as ArenaConfig;
  return config;
}
