import { describe, it, expect, vi } from 'vitest';
import { TraceEmitter, TraceEvent } from './traces';

describe('TraceEmitter', () => {
  it('emits structured trace events', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const emitter = new TraceEmitter();
    const event: TraceEvent = {
      timestamp: new Date(),
      sessionId: 'test-session',
      eventType: 'competition.start',
      data: { mode: 'round-robin', providers: 2 }
    };

    emitter.emit(event);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"eventType":"competition.start"'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"sessionId":"test-session"'));

    consoleSpy.mockRestore();
  });

  it('filters events by level', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const emitter = new TraceEmitter({ minLevel: 'warning' });

    emitter.emit({
      timestamp: new Date(),
      sessionId: 'test',
      eventType: 'debug.info',
      level: 'debug',
      data: {}
    });

    expect(consoleSpy).not.toHaveBeenCalled();

    emitter.emit({
      timestamp: new Date(),
      sessionId: 'test',
      eventType: 'provider.error',
      level: 'error',
      data: {}
    });

    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
