import OpenAI from 'openai';
import type { ProviderAdapter, ProviderConfig, ChatInput, ChatOutput } from './types';
import type { CNF } from '../cnf/types';

export class XAIAdapter implements ProviderAdapter {
  name = 'xai';
  private client?: OpenAI;

  async configure(config: ProviderConfig): Promise<void> {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.x.ai/v1'
    });
  }

  async listModels(): Promise<string[]> {
    return ['grok-beta', 'grok-vision-beta'];
  }

  async chat(input: ChatInput): Promise<ChatOutput> {
    if (!this.client) {
      throw new Error('xAI client not configured');
    }

    // Translate CNF to OpenAI format (xAI is compatible)
    const messages = input.cnf.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Call xAI API
    const response = await this.client.chat.completions.create({
      model: input.targetModel,
      messages: messages as any,
      temperature: input.temperature,
      max_tokens: input.maxTokens
    });

    const outputText = response.choices[0]?.message?.content || '';

    // Lift response to CNF
    const updatedCNF: CNF = {
      ...input.cnf,
      messages: [
        ...input.cnf.messages,
        { role: 'assistant', content: outputText }
      ]
    };

    return {
      updatedCNF,
      outputText,
      usage: response.usage ? {
        input: response.usage.prompt_tokens,
        output: response.usage.completion_tokens,
        total: response.usage.total_tokens
      } : undefined
    };
  }
}
