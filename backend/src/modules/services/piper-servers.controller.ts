import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PiperServer } from './schemas/piper-server.schema';
import { PiperService } from './piper.service';
import { AppLogger } from '../../common/logger';

/**
 * Controller für Piper-Server-Verwaltung
 */
@Controller('piper-servers')
export class PiperServersController {
  private readonly logger = new AppLogger('PiperServersController');

  constructor(
    @InjectModel(PiperServer.name) private piperServerModel: Model<PiperServer>,
    private readonly piperService: PiperService,
  ) {}

  /**
   * GET /api/piper-servers
   * Liefert alle gespeicherten Piper-Server
   */
  @Get()
  async getAllServers() {
    try {
      const servers = await this.piperServerModel.find().sort({ name: 1 }).exec();
      this.logger.debug('Fetched Piper servers', { count: servers.length });
      return servers;
    } catch (error) {
      this.logger.error('Failed to fetch Piper servers', error.message);
      throw error;
    }
  }

  /**
   * POST /api/piper-servers
   * Erstellt einen neuen Piper-Server
   */
  @Post()
  async createServer(@Body() body: { name: string; url: string; description?: string }) {
    try {
      this.logger.info('Creating new Piper server', { name: body.name, url: body.url });

      // Prüfe ob Name bereits existiert
      const existing = await this.piperServerModel.findOne({ name: body.name }).exec();
      if (existing) {
        throw new Error(`Piper-Server mit dem Namen "${body.name}" existiert bereits`);
      }

      // Erstelle neuen Server
      const server = new this.piperServerModel({
        name: body.name,
        url: body.url,
        description: body.description,
        isActive: true,
      });

      await server.save();

      this.logger.info('Piper server created successfully', { 
        id: (server as any)._id.toString(), 
        name: body.name 
      });

      return server;
    } catch (error) {
      this.logger.error('Failed to create Piper server', error.message);
      throw error;
    }
  }

  /**
   * POST /api/piper-servers/test-connection
   * Testet die Verbindung zu einer Piper-Server-URL (ohne Speicherung)
   */
  @Post('test-connection')
  async testConnection(@Body() body: { url: string }) {
    try {
      this.logger.info('Testing Piper server connection', { url: body.url });

      // Teste Verbindung
      const result = await this.piperService.testConnection(body.url);

      this.logger.info('Piper server test completed', { 
        url: body.url,
        success: result.success 
      });

      return result;
    } catch (error) {
      this.logger.error('Piper server test failed', error.message);
      throw error;
    }
  }

  /**
   * POST /api/piper-servers/:id/test
   * Testet die Verbindung zu einem Piper-Server (mit ID)
   */
  @Post(':id/test')
  async testServer(@Param('id') id: string) {
    try {
      const server = await this.piperServerModel.findById(id).exec();
      if (!server) {
        throw new Error('Piper-Server nicht gefunden');
      }

      this.logger.info('Testing Piper server connection', { 
        id, 
        name: server.name, 
        url: server.url 
      });

      // Teste Verbindung
      const result = await this.piperService.testConnection(server.url);

      // Speichere Test-Ergebnis
      server.lastTested = new Date();
      server.lastTestSuccess = result.success;
      server.lastTestMessage = result.message;
      await server.save();

      this.logger.info('Piper server test completed', { 
        id, 
        success: result.success 
      });

      return result;
    } catch (error) {
      this.logger.error('Piper server test failed', error.message);
      throw error;
    }
  }

  /**
   * PUT /api/piper-servers/:id
   * Aktualisiert einen Piper-Server
   */
  @Put(':id')
  async updateServer(
    @Param('id') id: string,
    @Body() body: { name?: string; url?: string; description?: string }
  ) {
    try {
      this.logger.info('Updating Piper server', { id, updates: body });

      const server = await this.piperServerModel.findById(id).exec();
      if (!server) {
        throw new Error('Piper-Server nicht gefunden');
      }

      // Aktualisiere Felder
      if (body.name !== undefined) server.name = body.name;
      if (body.url !== undefined) server.url = body.url;
      if (body.description !== undefined) server.description = body.description;

      await server.save();

      this.logger.info('Piper server updated successfully', { 
        id, 
        name: server.name 
      });

      return server;
    } catch (error) {
      this.logger.error('Failed to update Piper server', error.message);
      throw error;
    }
  }

  /**
   * DELETE /api/piper-servers/:id
   * Löscht einen Piper-Server
   */
  @Delete(':id')
  async deleteServer(@Param('id') id: string) {
    try {
      this.logger.info('Deleting Piper server', { id });

      const result = await this.piperServerModel.findByIdAndDelete(id).exec();
      if (!result) {
        throw new Error('Piper-Server nicht gefunden');
      }

      this.logger.info('Piper server deleted successfully', { 
        id, 
        name: result.name 
      });

      return { success: true, message: 'Piper-Server gelöscht' };
    } catch (error) {
      this.logger.error('Failed to delete Piper server', error.message);
      throw error;
    }
  }
}

