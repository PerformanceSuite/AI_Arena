import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArtifactStore, Artifact } from './storage';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ArtifactStore', () => {
  const testBasePath = './test-artifacts';
  let store: ArtifactStore;

  beforeEach(() => {
    store = new ArtifactStore(testBasePath);
  });

  afterEach(async () => {
    await fs.rm(testBasePath, { recursive: true, force: true });
  });

  it('stores and retrieves artifacts', async () => {
    const artifact: Artifact = {
      id: 'test-123',
      sessionId: 'session-abc',
      type: 'document',
      content: 'Test content',
      metadata: { author: 'test' },
      createdAt: new Date()
    };

    const storedPath = await store.store(artifact);
    expect(storedPath).toContain('test-artifacts');
    expect(storedPath).toContain('session-abc');

    const retrieved = await store.retrieve(artifact.id);
    expect(retrieved.content).toBe('Test content');
    expect(retrieved.metadata.author).toBe('test');
  });

  it('lists artifacts by session', async () => {
    const artifacts: Artifact[] = [
      {
        id: 'art-1',
        sessionId: 'session-1',
        type: 'code',
        content: 'Code 1',
        metadata: {},
        createdAt: new Date()
      },
      {
        id: 'art-2',
        sessionId: 'session-1',
        type: 'document',
        content: 'Doc 1',
        metadata: {},
        createdAt: new Date()
      }
    ];

    for (const artifact of artifacts) {
      await store.store(artifact);
    }

    const list = await store.listBySession('session-1');
    expect(list).toHaveLength(2);
  });
});
