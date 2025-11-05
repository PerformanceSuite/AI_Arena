import { serve } from '@hono/node-server';
import { app } from './routes';

let server: any;

export interface ServerConfig {
  port: number;
}

export async function startServer(config: ServerConfig): Promise<void> {
  server = serve({
    fetch: app.fetch,
    port: config.port
  });

  console.log(`🚀 HTTP server running on http://localhost:${config.port}`);
}

export async function stopServer(): Promise<void> {
  if (server) {
    server.close();
  }
}
