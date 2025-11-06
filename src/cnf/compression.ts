import type { CNF } from './types';

export interface CompressionConfig {
  strategy: 'summarize' | 'truncate' | 'sliding-window';
  maxTokens: number;
  preserveRecent: number;
}

export async function compressCNF(
  cnf: CNF,
  config: CompressionConfig,
  summarizeFn?: (messages: CNF['messages']) => Promise<string>
): Promise<CNF> {
  // No compression needed if under threshold
  if (cnf.messages.length <= config.preserveRecent) {
    return cnf;
  }

  // Split messages
  const oldMessages = cnf.messages.slice(0, -config.preserveRecent);
  const recentMessages = cnf.messages.slice(-config.preserveRecent);

  // Summarize old messages
  const summary = summarizeFn
    ? await summarizeFn(oldMessages)
    : `[Conversation summary: ${oldMessages.length} messages]`;

  return {
    ...cnf,
    messages: [
      { role: 'system', content: `[Conversation summary]: ${summary}` },
      ...recentMessages
    ]
  };
}
