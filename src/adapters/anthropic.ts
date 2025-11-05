import Anthropic from '@anthropic-ai/sdk';
import type { ProviderAdapter, ChatArgs, ChatResult } from './types';
import type { CNF } from '../cnf/types';
import { appendMessage } from '../cnf/transform';

export class AnthropicAdapter implements ProviderAdapter {
  name = 'anthropic';
  private client?: Anthropic;

  async configure(config: { apiKey: string }): Promise<void> {
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async listModels(): Promise<string[]> {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ];
  }

  async chat(args: ChatArgs): Promise<ChatResult> {
    if (!this.client) {
      throw new Error('Anthropic adapter not configured');
    }

    // Extract system messages (Anthropic uses separate system param)
    const systemMessages = args.cnf.messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n');

    const system = args.system || systemMessages || undefined;

    // Convert CNF messages to Anthropic format (exclude system messages)
    const messages = args.cnf.messages
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

    const response = await this.client.messages.create({
      model: args.targetModel,
      max_tokens: args.maxTokens ?? 4096,
      temperature: args.temperature ?? 0.7,
      system,
      messages: messages as any
    });

    const textContent = response.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('');

    const updatedCNF = appendMessage(args.cnf, 'assistant', textContent);

    return {
      updatedCNF,
      outputText: textContent,
      usage: response.usage ? {
        prompt: response.usage.input_tokens,
        completion: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens
      } : undefined
    };
  }
}
