import * as fs from 'fs/promises';
import * as path from 'path';

export interface Artifact {
  id: string;
  sessionId: string;
  type: 'code' | 'document' | 'image' | 'data';
  content: string | Buffer;
  metadata: Record<string, any>;
  createdAt: Date;
}

export class ArtifactStore {
  constructor(private basePath: string = './artifacts') {}

  async store(artifact: Artifact): Promise<string> {
    const sessionDir = path.join(this.basePath, artifact.sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    const artifactPath = path.join(sessionDir, `${artifact.id}.json`);
    const data = {
      ...artifact,
      content: artifact.content.toString(),
      createdAt: artifact.createdAt.toISOString()
    };

    await fs.writeFile(artifactPath, JSON.stringify(data, null, 2));
    return artifactPath;
  }

  async retrieve(id: string): Promise<Artifact> {
    // Search all session directories
    const sessions = await fs.readdir(this.basePath);

    for (const session of sessions) {
      const artifactPath = path.join(this.basePath, session, `${id}.json`);
      try {
        const data = await fs.readFile(artifactPath, 'utf-8');
        const parsed = JSON.parse(data);
        return {
          ...parsed,
          createdAt: new Date(parsed.createdAt)
        };
      } catch {
        // Try next session
        continue;
      }
    }

    throw new Error(`Artifact ${id} not found`);
  }

  async listBySession(sessionId: string): Promise<Artifact[]> {
    const sessionDir = path.join(this.basePath, sessionId);

    try {
      const files = await fs.readdir(sessionDir);
      const artifacts: Artifact[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(path.join(sessionDir, file), 'utf-8');
          const parsed = JSON.parse(data);
          artifacts.push({
            ...parsed,
            createdAt: new Date(parsed.createdAt)
          });
        }
      }

      return artifacts;
    } catch {
      return [];
    }
  }
}
