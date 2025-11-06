export interface TraceEvent {
  timestamp: Date;
  sessionId: string;
  eventType:
    | 'competition.start'
    | 'competition.end'
    | 'provider.invoke'
    | 'provider.error'
    | 'judge.score'
    | 'debate.turn'
    | 'debug.info';
  level?: 'debug' | 'info' | 'warning' | 'error';
  data: Record<string, any>;
}

export interface TraceEmitterConfig {
  minLevel?: 'debug' | 'info' | 'warning' | 'error';
  format?: 'json' | 'pretty';
}

const LEVEL_PRIORITY = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3
};

export class TraceEmitter {
  constructor(private config: TraceEmitterConfig = {}) {}

  emit(event: TraceEvent): void {
    const eventLevel = event.level || 'info';
    const minLevel = this.config.minLevel || 'debug';

    // Filter by level
    if (LEVEL_PRIORITY[eventLevel] < LEVEL_PRIORITY[minLevel]) {
      return;
    }

    // Emit as JSON (Phase 2)
    const output = {
      ...event,
      timestamp: event.timestamp.toISOString()
    };

    console.log(JSON.stringify(output));
  }
}

// Singleton instance
let globalEmitter: TraceEmitter | null = null;

export function getTraceEmitter(config?: TraceEmitterConfig): TraceEmitter {
  if (!globalEmitter) {
    globalEmitter = new TraceEmitter(config);
  }
  return globalEmitter;
}

export function emitTrace(event: TraceEvent): void {
  getTraceEmitter().emit(event);
}
