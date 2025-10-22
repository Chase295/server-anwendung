import { Controller, Get, Post, Put, Delete, Body, Param, Req } from '@nestjs/common';
import { FlowCoreService } from './flow-core.service';
import { NodeFactory } from './node-factory';
import { AppLogger } from '../../common/logger';

/**
 * Controller für Flow-Management
 */
@Controller('flows')
export class FlowCoreController {
  private readonly logger = new AppLogger('FlowCoreController');

  constructor(
    private readonly flowService: FlowCoreService,
    private readonly nodeFactory: NodeFactory,
  ) {}

  @Get()
  async getAllFlows() {
    const flows = await this.flowService.getAllFlows();
    const activeFlows = this.flowService.getActiveFlows();

    return flows.map(flow => ({
      ...(flow as any).toObject(),
      isRunning: activeFlows.some(af => af.id === (flow as any)._id.toString()),
    }));
  }

  @Get('schemas')
  getNodeSchemas() {
    return this.nodeFactory.getAllNodeSchemas();
  }

  @Get(':id')
  async getFlow(@Param('id') id: string) {
    const flow = await this.flowService.getFlow(id);
    const activeFlows = this.flowService.getActiveFlows();
    
    // isRunning Status hinzufügen
    return {
      ...(flow as any).toObject(),
      isRunning: activeFlows.some(af => af.id === (flow as any)._id.toString()),
    };
  }

  @Post()
  async createFlow(@Body() body: { name: string; description: string; definition: any }) {
    this.logger.info('📝 Creating new flow', { 
      name: body.name, 
      description: body.description,
      nodeCount: body.definition?.nodes?.length || 0,
      edgeCount: body.definition?.edges?.length || 0
    });
    
    const flow = await this.flowService.createFlow(body.name, body.description, body.definition);
    
    this.logger.info('✅ Flow created successfully', { 
      flowId: (flow as any)._id.toString(), 
      name: body.name 
    });
    
    return flow;
  }

  @Put(':id')
  async updateFlow(@Param('id') id: string, @Body() body: any) {
    this.logger.info('✏️  Updating flow', { 
      flowId: id, 
      name: body.name,
      nodeCount: body.definition?.nodes?.length || 0,
      edgeCount: body.definition?.edges?.length || 0
    });
    
    const flow = await this.flowService.updateFlow(id, body);
    
    this.logger.info('✅ Flow updated successfully', { 
      flowId: id, 
      name: body.name 
    });
    
    return flow;
  }

  @Delete(':id')
  async deleteFlow(@Param('id') id: string) {
    this.logger.warn('🗑️  Deleting flow', { flowId: id });
    
    await this.flowService.deleteFlow(id);
    
    this.logger.info('✅ Flow deleted successfully', { flowId: id });
    
    return { success: true };
  }

  @Post(':id/start')
  async startFlow(@Param('id') id: string) {
    this.logger.info('▶️  Starting flow', { flowId: id });
    
    try {
      await this.flowService.startFlow(id);
      this.logger.info('✅ Flow started successfully', { flowId: id });
      return { success: true, message: 'Flow started' };
    } catch (error) {
      this.logger.error('❌ Failed to start flow', error.message, { flowId: id });
      throw error;
    }
  }

  @Post(':id/stop')
  async stopFlow(@Param('id') id: string) {
    this.logger.info('⏹️  Stopping flow', { flowId: id });
    
    try {
      await this.flowService.stopFlow(id);
      this.logger.info('✅ Flow stopped successfully', { flowId: id });
      return { success: true, message: 'Flow stopped' };
    } catch (error) {
      this.logger.error('❌ Failed to stop flow', error.message, { flowId: id });
      throw error;
    }
  }
}

