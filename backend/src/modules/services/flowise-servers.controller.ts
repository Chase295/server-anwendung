import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FlowiseServer } from './schemas/flowise-server.schema';
import { FlowiseService } from './flowise.service';
import { AppLogger } from '../../common/logger';

/**
 * Controller für Flowise-Server-Verwaltung
 */
@Controller('flowise-servers')
export class FlowiseServersController {
  private readonly logger = new AppLogger('FlowiseServersController');

  constructor(
    @InjectModel(FlowiseServer.name) private flowiseServerModel: Model<FlowiseServer>,
    private readonly flowiseService: FlowiseService,
  ) {}

  /**
   * GET /api/flowise-servers
   * Liefert alle gespeicherten Flowise-Server
   */
  @Get()
  async getAllServers() {
    try {
      const servers = await this.flowiseServerModel.find().sort({ name: 1 }).exec();
      this.logger.debug('Fetched Flowise servers', { count: servers.length });
      return servers;
    } catch (error) {
      this.logger.error('Failed to fetch Flowise servers', error.message);
      throw error;
    }
  }

  /**
   * POST /api/flowise-servers
   * Erstellt einen neuen Flowise-Server
   */
  @Post()
  async createServer(@Body() body: { name: string; script: string; description?: string }) {
    try {
      this.logger.info('Creating new Flowise server', { name: body.name });

      // Prüfe ob Name bereits existiert
      const existing = await this.flowiseServerModel.findOne({ name: body.name }).exec();
      if (existing) {
        throw new Error(`Flowise-Server mit dem Namen "${body.name}" existiert bereits`);
      }

      // Parse das Flowise-Script
      const { apiUrl, authToken } = this.flowiseService.parseFlowiseScript(body.script);

      // Erstelle neuen Server
      const server = new this.flowiseServerModel({
        name: body.name,
        apiUrl,
        authToken,
        description: body.description,
        isActive: true,
      });

      await server.save();

      this.logger.info('Flowise server created successfully', { 
        id: (server as any)._id.toString(), 
        name: body.name 
      });

      return server;
    } catch (error) {
      this.logger.error('Failed to create Flowise server', error.message);
      throw error;
    }
  }

  /**
   * POST /api/flowise-servers/test-script
   * Testet ein Flowise-Script ohne es zu speichern
   */
  @Post('test-script')
  async testScript(@Body() body: { script: string }) {
    try {
      this.logger.info('Testing Flowise script', { scriptLength: body.script.length });

      // Validiere Input
      if (!body.script || body.script.trim().length === 0) {
        return {
          success: false,
          message: 'Kein Script angegeben',
        };
      }

      // Parse das Script
      let apiUrl: string;
      let authToken: string;
      
      try {
        const parsed = this.flowiseService.parseFlowiseScript(body.script);
        apiUrl = parsed.apiUrl;
        authToken = parsed.authToken;
      } catch (parseError) {
        this.logger.error('Failed to parse Flowise script', parseError.message);
        return {
          success: false,
          message: parseError.message,
        };
      }

      // Teste Verbindung
      const result = await this.flowiseService.testConnection({
        apiUrl,
        authToken,
      });

      this.logger.info('Flowise script test completed', { success: result.success });

      return result;
    } catch (error) {
      this.logger.error('Flowise script test failed', error.message, { error });
      
      // Gebe immer ein JSON-Objekt zurück
      return {
        success: false,
        message: `Test fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`,
      };
    }
  }

  /**
   * POST /api/flowise-servers/:id/test
   * Testet die Verbindung zu einem Flowise-Server
   */
  @Post(':id/test')
  async testServer(@Param('id') id: string) {
    try {
      const server = await this.flowiseServerModel.findById(id).exec();
      if (!server) {
        return {
          success: false,
          message: 'Flowise-Server nicht gefunden',
        };
      }

      this.logger.info('Testing Flowise server connection', { 
        id, 
        name: server.name, 
        apiUrl: server.apiUrl.substring(0, 50) + '...' 
      });

      // Teste Verbindung
      const result = await this.flowiseService.testConnection({
        apiUrl: server.apiUrl,
        authToken: server.authToken,
      });

      // Speichere Test-Ergebnis
      server.lastTested = new Date();
      server.lastTestSuccess = result.success;
      await server.save();

      this.logger.info('Flowise server test completed', { 
        id, 
        success: result.success 
      });

      return result;
    } catch (error) {
      this.logger.error('Flowise server test failed', error.message, { error });
      
      // Gebe immer JSON zurück
      return {
        success: false,
        message: `Test fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`,
      };
    }
  }

  /**
   * PUT /api/flowise-servers/:id
   * Aktualisiert einen Flowise-Server
   */
  @Put(':id')
  async updateServer(
    @Param('id') id: string,
    @Body() body: { name?: string; script?: string; description?: string }
  ) {
    try {
      this.logger.info('Updating Flowise server', { id, updates: body });

      const server = await this.flowiseServerModel.findById(id).exec();
      if (!server) {
        throw new Error('Flowise-Server nicht gefunden');
      }

      // Aktualisiere Felder
      if (body.name !== undefined) server.name = body.name;
      if (body.description !== undefined) server.description = body.description;

      // Wenn Script aktualisiert wird, parse es neu
      if (body.script !== undefined) {
        const { apiUrl, authToken } = this.flowiseService.parseFlowiseScript(body.script);
        server.apiUrl = apiUrl;
        server.authToken = authToken;
      }

      await server.save();

      this.logger.info('Flowise server updated successfully', { 
        id, 
        name: server.name 
      });

      return server;
    } catch (error) {
      this.logger.error('Failed to update Flowise server', error.message);
      throw error;
    }
  }

  /**
   * DELETE /api/flowise-servers/:id
   * Löscht einen Flowise-Server
   */
  @Delete(':id')
  async deleteServer(@Param('id') id: string) {
    try {
      this.logger.info('Deleting Flowise server', { id });

      const result = await this.flowiseServerModel.findByIdAndDelete(id).exec();
      if (!result) {
        throw new Error('Flowise-Server nicht gefunden');
      }

      this.logger.info('Flowise server deleted successfully', { 
        id, 
        name: result.name 
      });

      return { success: true, message: 'Flowise-Server gelöscht' };
    } catch (error) {
      this.logger.error('Failed to delete Flowise server', error.message);
      throw error;
    }
  }
}

