import type { ProviderAdapter, ChatArgs, ChatResult } from './types';
import type { CNF } from '../cnf/types';
import { appendMessage } from '../cnf/transform';

export class LocalAdapter implements ProviderAdapter {
  name = 'local';
  private endpoint: string = 'http://127.0.0.1:4000';

  async configure(config: { apiKey: string; endpoint?: string }): Promise<void> {
    if (config.endpoint) {
      this.endpoint = config.endpoint;
    }
  }

  async listModels(): Promise<string[]> {
    return ['local'];
  }

  async chat(args: ChatArgs): Promise<ChatResult> {
    // LiteLLM/Ollama use OpenAI-compatible API
    const messages = args.cnf.messages.map(msg => ({
      role: msg.role === 'tool' ? 'assistant' : msg.role,
      content: msg.content
    }));

    if (args.system) {
      messages.unshift({ role: 'system', content: args.system });
    }

    const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: args.targetModel,
        messages,
        temperature: args.temperature ?? 0.7,
        max_tokens: args.maxTokens
      })
    });

    if (!response.ok) {
      throw new Error(`Local adapter error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    const updatedCNF = appendMessage(args.cnf, 'assistant', content);

    return {
      updatedCNF,
      outputText: content,
      usage: data.usage ? {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
        total: data.usage.total_tokens
      } : undefined
    };
  }
}
