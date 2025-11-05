import type { ProviderAdapter, ChatArgs, ChatResult } from '../../src/adapters/types';
import { appendMessage } from '../../src/cnf/transform';

export class MockAdapter implements ProviderAdapter {
  name = 'mock';
  private responses: string[] = [];
  private configured = false;

  async configure(): Promise<void> {
    this.configured = true;
  }

  async listModels(): Promise<string[]> {
    return ['mock-model-1', 'mock-model-2'];
  }

  queueResponse(text: string): void {
    this.responses.push(text);
  }

  async chat(args: ChatArgs): Promise<ChatResult> {
    const responseText = this.responses.shift() || 'default mock response';

    const updatedCNF = appendMessage(args.cnf, 'assistant', responseText);

    return {
      updatedCNF,
      outputText: responseText,
      usage: { prompt: 10, completion: 20, total: 30 }
    };
  }
}
