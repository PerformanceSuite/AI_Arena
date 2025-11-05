import type { CNF, ToolCall, TokenUsage } from '../cnf/types';

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ChatArgs {
  cnf: CNF;
  targetModel: string;
  system?: string;
  tools?: ToolSpec[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  updatedCNF: CNF;
  outputText?: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
}

export interface ProviderAdapter {
  name: string;
  configure(config: { apiKey: string; endpoint?: string }): Promise<void>;
  listModels(): Promise<string[]>;
  chat(args: ChatArgs): Promise<ChatResult>;
}
