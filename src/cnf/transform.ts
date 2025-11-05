import type { CNF, Message } from './types';

/**
 * Append a message to CNF (immutable)
 */
export function appendMessage(
  cnf: CNF,
  role: Message['role'],
  content: string,
  meta?: Message['meta']
): CNF {
  const newMessage: Message = {
    role,
    content,
    timestamp: new Date().toISOString(),
    ...(meta && { meta })
  };

  return {
    ...cnf,
    messages: [...cnf.messages, newMessage]
  };
}

/**
 * Extract content of last message
 */
export function extractLastMessage(cnf: CNF): string {
  if (cnf.messages.length === 0) return '';
  return cnf.messages[cnf.messages.length - 1].content;
}

/**
 * Redact secrets from CNF using regex patterns
 */
export function redactSecrets(cnf: CNF): CNF {
  const secretPatterns = [
    /sk-[a-zA-Z0-9-_]+/g,            // OpenAI keys
    /sk-ant-[a-zA-Z0-9-_]+/g,        // Anthropic keys
    /AIza[a-zA-Z0-9_-]{35}/g,        // Google API keys
    /xai-[a-zA-Z0-9]{32,}/g,         // xAI keys
  ];

  function redactText(text: string): string {
    let redacted = text;
    for (const pattern of secretPatterns) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }
    return redacted;
  }

  return {
    ...cnf,
    messages: cnf.messages.map(msg => ({
      ...msg,
      content: redactText(msg.content)
    }))
  };
}
