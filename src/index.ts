import { loadConfig } from './util/config';
import { configureProviders } from './adapters/index';
import { startServer } from './http/server';

async function bootstrap() {
  try {
    console.log('🎪 AI Arena starting...');

    // Load configuration
    const config = loadConfig();
    console.log('✅ Configuration loaded');

    // Configure providers
    await configureProviders(config);
    console.log('✅ Providers configured');

    // Start HTTP server
    const port = config.server?.http?.port || 3457;
    await startServer({ port });

    console.log('✨ AI Arena ready!');
  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap();
}

export { bootstrap };
