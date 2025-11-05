export interface CNF {
  sessionId: string;
  messages: Message[];
  artifacts?: Artifact[];
  scratch?: Record<string, any>;
  tags?: string[];
  locale?: string;
  timezone?: string;
}

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  timestamp?: string;
  attachments?: Attachment[];
  citations?: string[];
  meta?: Record<string, any>;
}

export interface Attachment {
  kind: 'file' | 'image' | 'audio' | 'video' | 'url';
  uri: string;
  title?: string;
  meta?: Record<string, any>;
}

export interface Artifact {
  id: string;
  kind: 'doc' | 'code' | 'image' | 'audio' | 'video' | 'archive' | 'other';
  uri: string;
  title?: string;
  meta?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}
