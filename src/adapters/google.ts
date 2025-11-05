import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ProviderAdapter, ChatArgs, ChatResult } from './types';
import type { CNF } from '../cnf/types';
import { appendMessage } from '../cnf/transform';

export class GoogleAdapter implements ProviderAdapter {
  name = 'google';
  private client?: GoogleGenerativeAI;

  async configure(config: { apiKey: string }): Promise<void> {
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async listModels(): Promise<string[]> {
    return [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-pro'
    ];
  }

  async chat(args: ChatArgs): Promise<ChatResult> {
    if (!this.client) {
      throw new Error('Google adapter not configured');
    }

    const model = this.client.getGenerativeModel({
      model: args.targetModel
    });

    // Convert CNF to Google's format (chat history)
    const history = args.cnf.messages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const lastMessage = args.cnf.messages[args.cnf.messages.length - 1];

    // Build prompt with system message if provided
    let prompt = lastMessage.content;
    if (args.system) {
      prompt = `${args.system}\n\n${prompt}`;
    }

    const result = await model.generateContent({
      contents: [
        ...history,
        { role: 'user', parts: [{ text: prompt }] }
      ]
    });

    const response = result.response;
    const text = response.text();

    const updatedCNF = appendMessage(args.cnf, 'assistant', text);

    const usage = response.usageMetadata;

    return {
      updatedCNF,
      outputText: text,
      usage: usage ? {
        prompt: usage.promptTokenCount || 0,
        completion: usage.candidatesTokenCount || 0,
        total: usage.totalTokenCount || 0
      } : undefined
    };
  }
}
