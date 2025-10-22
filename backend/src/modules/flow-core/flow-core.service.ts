import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Flow, FlowDocument } from './schemas/flow.schema';
import { FlowEngine } from './flow-engine';
import { AppLogger } from '../../common/logger';

/**
 * Service für Flow-Verwaltung (CRUD)
 */
@Injectable()
export class FlowCoreService {
  private readonly logger = new AppLogger('FlowCoreService');

  constructor(
    @InjectModel(Flow.name) private flowModel: Model<FlowDocument>,
    private readonly flowEngine: FlowEngine,
  ) {}

  /**
   * Erstellt einen neuen Flow
   */
  async createFlow(name: string, description: string, definition: any): Promise<Flow> {
    try {
      const flow = await this.flowModel.create({
        name,
        description,
        definition,
        active: false,
      });

      this.logger.info('Flow created', { flowId: flow._id, name });
      return flow;
    } catch (error) {
      this.logger.error('Failed to create flow', error.message, { name });
      throw error;
    }
  }

  /**
   * Holt alle Flows
   */
  async getAllFlows(): Promise<Flow[]> {
    return this.flowModel.find().sort({ updatedAt: -1 });
  }

  /**
   * Holt einen Flow nach ID
   */
  async getFlow(flowId: string): Promise<Flow | null> {
    return this.flowModel.findById(flowId);
  }

  /**
   * Aktualisiert einen Flow
   */
  async updateFlow(flowId: string, updates: Partial<Flow>): Promise<Flow | null> {
    try {
      const flow = await this.flowModel.findByIdAndUpdate(
        flowId,
        updates,
        { new: true }
      );

      this.logger.info('Flow updated', { flowId });
      return flow;
    } catch (error) {
      this.logger.error('Failed to update flow', error.message, { flowId });
      throw error;
    }
  }

  /**
   * Löscht einen Flow
   */
  async deleteFlow(flowId: string): Promise<void> {
    // Zuerst stoppen, falls aktiv
    await this.stopFlow(flowId);

    await this.flowModel.findByIdAndDelete(flowId);
    this.logger.info('Flow deleted', { flowId });
  }

  /**
   * Startet einen Flow
   */
  async startFlow(flowId: string): Promise<void> {
    const flow = await this.getFlow(flowId);

    if (!flow) {
      throw new Error('Flow not found');
    }

    if (!flow.enabled) {
      throw new Error('Flow is disabled');
    }

    await this.flowEngine.startFlow(flowId, flow.definition);

    // Flow als aktiv markieren
    await this.flowModel.findByIdAndUpdate(flowId, {
      active: true,
      lastExecuted: new Date(),
    });

    this.logger.info('Flow execution started', { flowId, name: flow.name });
  }

  /**
   * Stoppt einen Flow
   */
  async stopFlow(flowId: string): Promise<void> {
    await this.flowEngine.stopFlow(flowId);

    // Flow als inaktiv markieren
    await this.flowModel.findByIdAndUpdate(flowId, {
      active: false,
    });

    this.logger.info('Flow execution stopped', { flowId });
  }

  /**
   * Gibt aktive Flows zurück
   */
  getActiveFlows() {
    return this.flowEngine.getActiveFlows();
  }
}

