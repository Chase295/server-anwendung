import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { WebSocketGateway } from './websocket.gateway';
import { DebugEventsGateway } from './debug-events.gateway';
import { AppLogger } from '../../common/logger';

/**
 * Controller für Device-Verwaltung
 */
@Controller('devices')
export class DevicesController {
  private readonly logger = new AppLogger('DevicesController');

  constructor(
    private readonly devicesService: DevicesService,
    private readonly wsGateway: WebSocketGateway,
    private readonly debugEventsGateway: DebugEventsGateway,
  ) {}

  @Get()
  async getAllDevices() {
    const devices = await this.devicesService.getAllDevices();
    const connectedClients = this.wsGateway.getConnectedClients();

    // Enriche mit Connection-Status
    return devices.map(device => ({
      ...(device as any).toObject(),
      isConnected: connectedClients.some(c => c.clientId === device.clientId),
    }));
  }

  /**
   * GET /api/devices/debug-events
   * Holt Debug-Events (gecacht für HTTP-Zugriff)
   * WICHTIG: Muss vor @Get(':clientId') stehen!
   */
  @Get('debug-events')
  getDebugEvents(@Query('flowId') flowId?: string, @Query('since') since?: string) {
    const sinceTime = since ? parseInt(since, 10) : undefined;
    const events = this.debugEventsGateway.getCachedEvents(flowId, sinceTime);
    return { events };
  }

  @Get(':clientId')
  async getDevice(@Param('clientId') clientId: string) {
    const device = await this.devicesService.getDevice(clientId);
    const isConnected = this.wsGateway.isClientConnected(clientId);

    return {
      ...(device as any)?.toObject(),
      isConnected,
    };
  }

  @Post()
  async registerDevice(
    @Body() body: {
      clientId: string;
      name: string;
      capabilities: string[];
      metadata?: any;
    }
  ) {
    this.logger.info('📱 Registering new device', { 
      clientId: body.clientId,
      name: body.name,
      capabilities: body.capabilities
    });
    
    const device = await this.devicesService.registerDevice(
      body.clientId,
      body.name,
      body.capabilities,
      body.metadata
    );
    
    this.logger.info('✅ Device registered successfully', { 
      clientId: body.clientId,
      name: body.name
    });
    
    return device;
  }

  @Delete(':clientId')
  async deleteDevice(@Param('clientId') clientId: string) {
    this.logger.warn('🗑️  Deleting device', { clientId });
    
    await this.devicesService.deleteDevice(clientId);
    
    this.logger.info('✅ Device deleted successfully', { clientId });
    
    return { success: true };
  }

  @Get('connected/list')
  getConnectedClients() {
    return this.wsGateway.getConnectedClients();
  }
}

