import { existsSync } from 'fs';
import { join } from 'path';
import { AppLogger } from './logger';

/**
 * Startup-Checks für System-Integrität und externe Services
 */
export class StartupChecks {
  private static readonly logger = new AppLogger('StartupChecks');

  /**
   * 1. Dependency Check: Prüft ob node_modules vorhanden ist
   */
  static checkDependencies(): void {
    this.logger.info('🔍 Checking Node.js dependencies...');

    const nodeModulesPath = join(process.cwd(), 'node_modules');
    const packageJsonPath = join(process.cwd(), 'package.json');

    // Prüfe ob package.json existiert
    if (!existsSync(packageJsonPath)) {
      this.logger.error('❌ package.json not found!');
      this.exitWithError(
        'CRITICAL: package.json not found in project root.\n' +
        'Please ensure you are running the server from the correct directory.'
      );
    }

    // Prüfe ob node_modules existiert
    if (!existsSync(nodeModulesPath)) {
      this.logger.error('❌ node_modules directory not found!');
      this.exitWithError(
        'CRITICAL: Dependencies not installed!\n\n' +
        '📦 Please run the following command to install dependencies:\n\n' +
        '   npm install\n\n' +
        'Then restart the server with:\n\n' +
        '   npm run start:dev\n'
      );
    }

    // Prüfe ob kritische Dependencies vorhanden sind
    const criticalDeps = [
      '@nestjs/core',
      '@nestjs/common',
      '@nestjs/mongoose',
      'mongoose',
      'ws',
      'winston',
    ];

    const missingDeps: string[] = [];

    for (const dep of criticalDeps) {
      const depPath = join(nodeModulesPath, dep);
      if (!existsSync(depPath)) {
        missingDeps.push(dep);
      }
    }

    if (missingDeps.length > 0) {
      this.logger.error('❌ Critical dependencies missing: ' + missingDeps.join(', '));
      this.exitWithError(
        'CRITICAL: Some required dependencies are missing!\n\n' +
        `Missing packages: ${missingDeps.join(', ')}\n\n` +
        '📦 Please run:\n\n' +
        '   npm install\n\n' +
        'to install all required dependencies.'
      );
    }

    this.logger.info('✅ All dependencies are installed');
  }

  /**
   * 2. MongoDB Health Check (KRITISCH - Server stoppt bei Fehler)
   */
  static async checkMongoDB(mongoUri: string): Promise<void> {
    this.logger.info('🔍 Checking MongoDB connection...');

    try {
      const mongoose = require('mongoose');

      // Timeout nach 10 Sekunden
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 10000);
      });

      const connectPromise = mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
      });

      await Promise.race([connectPromise, timeoutPromise]);

      // Verbindung erfolgreich - wieder trennen
      await mongoose.disconnect();

      this.logger.info('✅ MongoDB connection successful');
    } catch (error) {
      this.logger.error('❌ MongoDB connection failed', error.message);

      // Prüfe ob MongoDB überhaupt läuft
      const errorMessage = error.message || '';
      let helpText = '';

      if (errorMessage.includes('ECONNREFUSED')) {
        helpText =
          '\n💡 MongoDB is not running. Please start MongoDB:\n\n' +
          '   Option 1 - Homebrew (macOS):\n' +
          '      brew services start mongodb-community\n\n' +
          '   Option 2 - Docker:\n' +
          '      docker run -d --name mongodb -p 27017:27017 mongo:latest\n\n' +
          '   Option 3 - Manual:\n' +
          '      mongod --dbpath /path/to/data\n';
      } else if (errorMessage.includes('timeout')) {
        helpText =
          '\n💡 MongoDB connection timeout. Check:\n' +
          '   - Is MongoDB running?\n' +
          '   - Is the connection URI correct in .env?\n' +
          '   - Can the server reach the MongoDB host?\n';
      } else {
        helpText =
          '\n💡 MongoDB error. Please check:\n' +
          '   - MongoDB is running\n' +
          '   - Connection URI is correct in .env (MONGODB_URI)\n' +
          '   - Authentication credentials (if required)\n';
      }

      this.exitWithError(
        `CRITICAL: Cannot connect to MongoDB!\n\n` +
        `Error: ${error.message}\n` +
        `URI: ${this.maskSensitiveData(mongoUri)}\n` +
        helpText
      );
    }
  }

  /**
   * 3. Optional Services Health Check (NUR Warnung bei Fehler)
   * 
   * NEUE LOGIK: Prüft nur Services, die bereits in MongoDB konfiguriert wurden.
   * Wenn keine Konfigurationen vorhanden sind, wird die Prüfung übersprungen.
   */
  static async checkOptionalServices(
    flowModel: any,
    voskService: any,
    piperService: any,
    n8nService: any,
  ): Promise<void> {
    this.logger.info('🔍 Checking optional external services (from MongoDB)...');

    try {
      // Alle Flows aus MongoDB laden
      const flows = await flowModel.find({}).exec();

      if (!flows || flows.length === 0) {
        this.logger.info('💡 No flows configured yet. Skipping optional service checks.');
        return;
      }

      // Service-URLs aus allen Node-Konfigurationen sammeln
      const serviceUrls = {
        vosk: new Set<string>(),
        piper: new Set<string>(),
        n8n: new Set<string>(),
      };

      for (const flow of flows) {
        if (!flow.nodes || flow.nodes.length === 0) continue;

        for (const node of flow.nodes) {
          const config = node.data?.config;
          if (!config) continue;

          // STT Node (Vosk)
          if (node.data.type === 'stt' && config.serviceUrl) {
            serviceUrls.vosk.add(config.serviceUrl);
          }

          // TTS Node (Piper)
          if (node.data.type === 'tts' && config.serviceUrl) {
            serviceUrls.piper.add(config.serviceUrl);
          }

          // AI Node (n8n)
          if (node.data.type === 'ai' && config.webhookUrl) {
            serviceUrls.n8n.add(config.webhookUrl);
          }
        }
      }

      // Zähle konfigurierte Services
      const totalConfigured = 
        serviceUrls.vosk.size + 
        serviceUrls.piper.size + 
        serviceUrls.n8n.size;

      if (totalConfigured === 0) {
        this.logger.info('💡 No external services configured in flows. Skipping checks.');
        return;
      }

      this.logger.info('Found configured services', {
        vosk: serviceUrls.vosk.size,
        piper: serviceUrls.piper.size,
        n8n: serviceUrls.n8n.size,
      });

      const warnings: string[] = [];
      const successes: string[] = [];

      // Vosk Checks
      for (const url of serviceUrls.vosk) {
        try {
          const result = await voskService.testConnection(url);
          if (result.success) {
            successes.push(`Vosk (${url})`);
            this.logger.info('✅ Vosk service reachable', { url });
          } else {
            warnings.push(`Vosk (${url}): ${result.message}`);
            this.logger.warn('⚠️  Vosk service not reachable', { url });
          }
        } catch (error) {
          warnings.push(`Vosk (${url}): ${error.message}`);
          this.logger.warn('⚠️  Vosk service check failed', { url, error: error.message });
        }
      }

      // Piper Checks
      for (const url of serviceUrls.piper) {
        try {
          const result = await piperService.testConnection(url);
          if (result.success) {
            successes.push(`Piper (${url})`);
            this.logger.info('✅ Piper service reachable', { url });
          } else {
            warnings.push(`Piper (${url}): ${result.message}`);
            this.logger.warn('⚠️  Piper service not reachable', { url });
          }
        } catch (error) {
          warnings.push(`Piper (${url}): ${error.message}`);
          this.logger.warn('⚠️  Piper service check failed', { url, error: error.message });
        }
      }

      // n8n Checks
      for (const url of serviceUrls.n8n) {
        try {
          const result = await n8nService.testConnection(url);
          if (result.success) {
            successes.push(`n8n (${url})`);
            this.logger.info('✅ n8n service reachable', { url });
          } else {
            warnings.push(`n8n (${url}): ${result.message}`);
            this.logger.warn('⚠️  n8n service not reachable', { url });
          }
        } catch (error) {
          warnings.push(`n8n (${url}): ${error.message}`);
          this.logger.warn('⚠️  n8n service check failed', { url, error: error.message });
        }
      }

      // Zusammenfassung
      if (successes.length > 0) {
        this.logger.info(`✅ Reachable services (${successes.length}): ${successes.join(', ')}`);
      }

      if (warnings.length > 0) {
        this.logger.warn(
          `⚠️  Unreachable services (${warnings.length}):\n` +
          warnings.map((w) => `   - ${w}`).join('\n') +
          '\n\n' +
          '💡 The server will start, but affected nodes will not work.\n' +
          '   You can update service URLs in the Web-UI (Flow Editor).\n'
        );
      }

      if (warnings.length === 0 && successes.length > 0) {
        this.logger.info('✅ All configured external services are reachable');
      }

    } catch (error) {
      this.logger.error('Failed to check optional services from MongoDB', error);
      // Server startet trotzdem
    }
  }

  /**
   * Hilfsfunktion: Maskiert sensible Daten in URLs
   */
  private static maskSensitiveData(uri: string): string {
    try {
      // Maskiere Passwörter in MongoDB-URIs
      return uri.replace(/:([^:@]+)@/, ':****@');
    } catch {
      return uri;
    }
  }

  /**
   * Hilfsfunktion: Beendet den Prozess mit Fehlermeldung
   */
  private static exitWithError(message: string): never {
    console.error('\n' + '='.repeat(80));
    console.error('🚨 STARTUP ERROR');
    console.error('='.repeat(80));
    console.error('\n' + message);
    console.error('\n' + '='.repeat(80) + '\n');

    process.exit(1);
  }

  /**
   * Führt alle Startup-Checks durch
   */
  static async runAllChecks(
    mongoUri: string,
    services?: {
      flowModel?: any;
      voskService?: any;
      piperService?: any;
      n8nService?: any;
    }
  ): Promise<void> {
    this.logger.info('🚀 Running startup checks...\n');

    // 1. Dependency Check (KRITISCH)
    this.checkDependencies();

    // 2. MongoDB Check (KRITISCH)
    await this.checkMongoDB(mongoUri);

    // 3. Optional Services Check (NUR Warnung, nur wenn in MongoDB konfiguriert)
    if (services?.flowModel && services?.voskService && services?.piperService && services?.n8nService) {
      await this.checkOptionalServices(
        services.flowModel,
        services.voskService,
        services.piperService,
        services.n8nService
      );
    }

    this.logger.info('\n✅ All startup checks passed successfully!\n');
  }
}

