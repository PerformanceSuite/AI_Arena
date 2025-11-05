import { z } from 'zod';
import type { CNF } from './types';

const MessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  name: z.string().optional(),
  timestamp: z.string().optional(),
  attachments: z.array(z.any()).optional(),
  citations: z.array(z.string()).optional(),
  meta: z.record(z.string(), z.any()).optional()
});

const CNFSchema = z.object({
  sessionId: z.string(),
  messages: z.array(MessageSchema),
  artifacts: z.array(z.any()).optional(),
  scratch: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  locale: z.string().optional(),
  timezone: z.string().optional()
});

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  data?: CNF;
}

export function validateCNF(data: unknown): ValidationResult {
  const result = CNFSchema.safeParse(data);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  const errors = result.error.issues.map(e =>
    e.path.length > 0 ? String(e.path.join('.')) : e.message
  );

  return { valid: false, errors };
}
