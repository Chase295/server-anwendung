import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VoskServer } from './schemas/vosk-server.schema';
import { VoskService } from './vosk.service';
import { AppLogger } from '../../common/logger';

/**
 * Controller für Vosk-Server-Verwaltung
 */
@Controller('vosk-servers')
export class VoskServersController {
  private readonly logger = new AppLogger('VoskServersController');

  constructor(
    @InjectModel(VoskServer.name) private voskServerModel: Model<VoskServer>,
    private readonly voskService: VoskService,
  ) {}

  /**
   * GET /api/vosk-servers
   * Liefert alle gespeicherten Vosk-Server
   */
  @Get()
  async getAllServers() {
    try {
      const servers = await this.voskServerModel.find().sort({ name: 1 }).exec();
      this.logger.debug('Fetched Vosk servers', { count: servers.length });
      return servers;
    } catch (error) {
      this.logger.error('Failed to fetch Vosk servers', error.message);
      throw error;
    }
  }

  /**
   * POST /api/vosk-servers
   * Erstellt einen neuen Vosk-Server
   */
  @Post()
  async createServer(@Body() body: { name: string; url: string; description?: string }) {
    try {
      this.logger.info('Creating new Vosk server', { name: body.name, url: body.url });

      // Prüfe ob Name bereits existiert
      const existing = await this.voskServerModel.findOne({ name: body.name }).exec();
      if (existing) {
        throw new Error(`Vosk-Server mit dem Namen "${body.name}" existiert bereits`);
      }

      // Erstelle neuen Server
      const server = new this.voskServerModel({
        name: body.name,
        url: body.url,
        description: body.description,
        isActive: true,
      });

      await server.save();

      this.logger.info('Vosk server created successfully', { 
        id: (server as any)._id.toString(), 
        name: body.name 
      });

      return server;
    } catch (error) {
      this.logger.error('Failed to create Vosk server', error.message);
      throw error;
    }
  }

  /**
   * POST /api/vosk-servers/:id/test
   * Testet die Verbindung zu einem Vosk-Server
   */
  @Post(':id/test')
  async testServer(@Param('id') id: string) {
    try {
      const server = await this.voskServerModel.findById(id).exec();
      if (!server) {
        throw new Error('Vosk-Server nicht gefunden');
      }

      this.logger.info('Testing Vosk server connection', { 
        id, 
        name: server.name, 
        url: server.url 
      });

      // Teste Verbindung
      const result = await this.voskService.testConnection(server.url);

      // Speichere Test-Ergebnis
      server.lastTested = new Date();
      server.lastTestSuccess = result.success;
      await server.save();

      this.logger.info('Vosk server test completed', { 
        id, 
        success: result.success 
      });

      return result;
    } catch (error) {
      this.logger.error('Vosk server test failed', error.message);
      throw error;
    }
  }

  /**
   * PUT /api/vosk-servers/:id
   * Aktualisiert einen Vosk-Server
   */
  @Put(':id')
  async updateServer(
    @Param('id') id: string,
    @Body() body: { name?: string; url?: string; description?: string }
  ) {
    try {
      this.logger.info('Updating Vosk server', { id, updates: body });

      const server = await this.voskServerModel.findById(id).exec();
      if (!server) {
        throw new Error('Vosk-Server nicht gefunden');
      }

      // Aktualisiere Felder
      if (body.name !== undefined) server.name = body.name;
      if (body.url !== undefined) server.url = body.url;
      if (body.description !== undefined) server.description = body.description;

      await server.save();

      this.logger.info('Vosk server updated successfully', { 
        id, 
        name: server.name 
      });

      return server;
    } catch (error) {
      this.logger.error('Failed to update Vosk server', error.message);
      throw error;
    }
  }

  /**
   * DELETE /api/vosk-servers/:id
   * Löscht einen Vosk-Server
   */
  @Delete(':id')
  async deleteServer(@Param('id') id: string) {
    try {
      this.logger.info('Deleting Vosk server', { id });

      const result = await this.voskServerModel.findByIdAndDelete(id).exec();
      if (!result) {
        throw new Error('Vosk-Server nicht gefunden');
      }

      this.logger.info('Vosk server deleted successfully', { 
        id, 
        name: result.name 
      });

      return { success: true, message: 'Vosk-Server gelöscht' };
    } catch (error) {
      this.logger.error('Failed to delete Vosk server', error.message);
      throw error;
    }
  }
}

