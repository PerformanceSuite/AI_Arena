import OpenAI from 'openai';
import type { ProviderAdapter, ChatArgs, ChatResult } from './types';
import type { CNF, Message } from '../cnf/types';
import { appendMessage } from '../cnf/transform';

export class OpenAIAdapter implements ProviderAdapter {
  name = 'openai';
  private client?: OpenAI;

  async configure(config: { apiKey: string }): Promise<void> {
    this.client = new OpenAI({ apiKey: config.apiKey });
  }

  async listModels(): Promise<string[]> {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo'
    ];
  }

  async chat(args: ChatArgs): Promise<ChatResult> {
    if (!this.client) {
      throw new Error('OpenAI adapter not configured');
    }

    // Convert CNF messages to OpenAI format
    const messages = args.cnf.messages.map(msg => ({
      role: msg.role === 'tool' ? 'assistant' : msg.role,
      content: msg.content
    }));

    // Add system message if provided
    if (args.system) {
      messages.unshift({ role: 'system', content: args.system });
    }

    const response = await this.client.chat.completions.create({
      model: args.targetModel,
      messages: messages as any,
      temperature: args.temperature ?? 0.7,
      max_tokens: args.maxTokens
    });

    const assistantMessage = response.choices[0]?.message;
    const content = assistantMessage?.content || '';

    const updatedCNF = appendMessage(args.cnf, 'assistant', content);

    return {
      updatedCNF,
      outputText: content,
      usage: response.usage ? {
        prompt: response.usage.prompt_tokens,
        completion: response.usage.completion_tokens,
        total: response.usage.total_tokens
      } : undefined
    };
  }
}
