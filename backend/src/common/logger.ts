import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Zentraler Logger mit Winston
 * Strukturiertes Logging im JSON-Format mit Rotation
 */
export class AppLogger {
  private logger: winston.Logger;

  constructor(context?: string) {
    const logDir = path.join(process.cwd(), 'logs');

    // Erstelle logs-Verzeichnis wenn es nicht existiert
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Format für Console-Output (entwicklerfreundlich)
    const consoleFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
        const ctx = context ? `[${context}]` : '';
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} ${level} ${ctx} ${message} ${metaStr}`;
      })
    );

    // Format für File-Output (lesbar, nicht JSON für einfacheres Parsing)
    const fileFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
        const ctx = context ? `[${context}]` : '';
        const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `${timestamp} ${level} ${ctx} ${message}${metaStr}`;
      })
    );

    // Transports
    const transports: winston.transport[] = [
      // Console
      new winston.transports.Console({
        format: consoleFormat,
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      }),
    ];

    // File-Transports nur in Produktion oder wenn explizit aktiviert
    if (process.env.NODE_ENV === 'production' || process.env.FILE_LOGGING === 'true') {
      // Alle Logs in eine Datei (app-YYYY-MM-DD.log)
      transports.push(
        new DailyRotateFile({
          filename: path.join(logDir, 'app-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          format: fileFormat,
          maxSize: '20m',
          maxFiles: '14d',
        })
      );
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      defaultMeta: { context },
      transports,
    });
  }

  error(message: string, trace?: string, meta?: Record<string, any>): void {
    this.logger.error(message, { trace, ...meta });
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, meta);
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(message, meta);
  }

  verbose(message: string, meta?: Record<string, any>): void {
    this.logger.verbose(message, meta);
  }

  /**
   * Spezielles Logging für USO-Datenströme
   */
  logUSO(direction: 'in' | 'out', uso: any, meta?: Record<string, any>): void {
    this.logger.debug('USO Stream', {
      direction,
      usoHeader: uso.header,
      payloadSize: uso.payload?.length || 0,
      payloadType: typeof uso.payload,
      ...meta,
    });
  }

  /**
   * Logging für WebSocket-Events
   */
  logWebSocket(event: string, meta?: Record<string, any>): void {
    this.logger.info(`WebSocket: ${event}`, meta);
  }
}

// Globale Logger-Instanz
export const globalLogger = new AppLogger('Global');

