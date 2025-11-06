import OpenAI from 'openai';
import type { ProviderAdapter, ChatArgs, ChatResult } from './types';
import type { CNF, Message } from '../cnf/types';

export class XAIAdapter implements ProviderAdapter {
  name = 'xai';
  private client?: OpenAI;

  async configure(config: { apiKey: string; baseURL?: string }): Promise<void> {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.x.ai/v1'
    });
  }

  async listModels(): Promise<string[]> {
    return ['grok-beta', 'grok-vision-beta'];
  }

  async chat(args: ChatArgs): Promise<ChatResult> {
    if (!this.client) {
      throw new Error('xAI client not configured');
    }

    // Translate CNF to OpenAI format (xAI is compatible)
    const messages = args.cnf.messages.map((msg: Message) => ({
      role: msg.role,
      content: msg.content
    }));

    // Call xAI API
    const response = await this.client.chat.completions.create({
      model: args.targetModel,
      messages: messages as any,
      temperature: args.temperature,
      max_tokens: args.maxTokens
    });

    const outputText = response.choices[0]?.message?.content || '';

    // Lift response to CNF
    const updatedCNF: CNF = {
      ...args.cnf,
      messages: [
        ...args.cnf.messages,
        { role: 'assistant', content: outputText }
      ]
    };

    return {
      updatedCNF,
      outputText,
      usage: response.usage ? {
        prompt: response.usage.prompt_tokens,
        completion: response.usage.completion_tokens,
        total: response.usage.total_tokens
      } : undefined
    };
  }
}
