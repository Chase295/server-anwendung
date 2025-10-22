import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { globalLogger } from './common/logger';
import { StartupChecks } from './common/startup-checks';
import { VoskService } from './modules/services/vosk.service';
import { PiperService } from './modules/services/piper.service';
import { N8nService } from './modules/services/n8n.service';

async function bootstrap() {
  globalLogger.info('═══════════════════════════════════════════════════════════');
  globalLogger.info('🚀 IoT & Voice Orchestrator Server - Starting up...');
  globalLogger.info('═══════════════════════════════════════════════════════════\n');

  // ============================================================================
  // STAGE 1: Pre-Bootstrap Checks (VOR NestFactory.create)
  // ============================================================================
  globalLogger.info('🔍 Stage 1: Checking dependencies...');
  StartupChecks.checkDependencies();
  globalLogger.info('✅ Stage 1 complete: All dependencies installed\n');

  // ============================================================================
  // STAGE 2: Create NestJS Application
  // ============================================================================
  globalLogger.info('🔧 Stage 2: Creating NestJS application...');
  const app = await NestFactory.create(AppModule, {
    logger: console, // NestJS verwendet Console-Logger, unser Winston-Logger wird in Services verwendet
  });
  globalLogger.info('✅ Stage 2 complete: NestJS application created\n');

  // ============================================================================
  // STAGE 3: Post-Bootstrap Checks (NACH NestFactory.create, VOR listen)
  // ============================================================================
  globalLogger.info('🔍 Stage 3: Checking external services...');

  // MongoDB Check wird von NestJS/Mongoose selbst gehandhabt
  // Ein manueller Check würde die Connection stören!
  globalLogger.info('✅ MongoDB connection managed by NestJS/Mongoose');

  // Optional Services Check (NUR Warnung, nur wenn in MongoDB konfiguriert)
  try {
    // Services holen
    const voskService = app.get(VoskService);
    const piperService = app.get(PiperService);
    const n8nService = app.get(N8nService);

    // Flow Model holen (für Zugriff auf gespeicherte Konfigurationen)
    const mongoose = require('mongoose');
    const flowModel = mongoose.model('Flow');

    await StartupChecks.checkOptionalServices(
      flowModel,
      voskService,
      piperService,
      n8nService
    );
  } catch (error) {
    globalLogger.warn('⚠️  Could not check optional services:', error.message);
  }

  globalLogger.info('✅ Stage 3 complete: External services checked\n');

  // ============================================================================
  // STAGE 4: Application Configuration
  // ============================================================================
  globalLogger.info('⚙️  Stage 4: Configuring application...');

  // Trust Proxy (für Nginx)
  if (process.env.TRUST_PROXY === 'true') {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', true);
    globalLogger.info('  ✓ Proxy trust enabled (for Nginx)');
  }

  // CORS aktivieren
  const corsOrigin = process.env.FRONTEND_URL || 'http://localhost:3001';
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  globalLogger.info(`  ✓ CORS enabled for: ${corsOrigin}`);

  // Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  globalLogger.info('  ✓ Validation pipe configured');

  // API-Prefix
  app.setGlobalPrefix('api');
  globalLogger.info('  ✓ API prefix set to: /api');
  
  globalLogger.info('✅ Stage 4 complete: Application configured\n');

  // ============================================================================
  // STAGE 5: Start HTTP Server
  // ============================================================================
  const port = process.env.PORT || 3000;
  const wsPort = process.env.WS_PORT || 8080;
  
  globalLogger.info(`🎧 Stage 5: Starting HTTP server on port ${port}...`);
  await app.listen(port);

  globalLogger.info('\n═══════════════════════════════════════════════════════════');
  globalLogger.info('✅ Server successfully started!');
  globalLogger.info('═══════════════════════════════════════════════════════════');
  globalLogger.info(`📡 HTTP/API Server:    http://localhost:${port}/api`);
  globalLogger.info(`🔌 WebSocket Server:   ws://localhost:${wsPort}`);
  globalLogger.info(`🌐 Frontend URL:       ${corsOrigin}`);
  globalLogger.info(`🔐 Encryption:         ${process.env.ENCRYPTION_KEY ? 'Enabled' : '⚠️  Default key (not secure!)'}`);
  globalLogger.info(`🗄️  MongoDB:            ${process.env.MONGODB_URI || 'mongodb://localhost:27017/iot-orchestrator'}`);
  globalLogger.info('═══════════════════════════════════════════════════════════');
  globalLogger.info('📝 Logs are being written to: ./logs/app-*.log');
  globalLogger.info('🔍 Use "docker-compose logs -f backend" to tail logs\n');
}

bootstrap().catch((error) => {
  globalLogger.error('Failed to start application', error.message);
  process.exit(1);
});

