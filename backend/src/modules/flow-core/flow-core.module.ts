import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlowCoreService } from './flow-core.service';
import { FlowCoreController } from './flow-core.controller';
import { FlowEngine } from './flow-engine';
import { NodeFactory } from './node-factory';
import { Flow, FlowSchema } from './schemas/flow.schema';
import { DevicesModule } from '../devices/devices.module';
import { VoskService } from '../services/vosk.service';
import { PiperService } from '../services/piper.service';
import { N8nService } from '../services/n8n.service';
import { FlowiseService } from '../services/flowise.service';
import { VoskServersController } from '../services/vosk-servers.controller';
import { VoskServer, VoskServerSchema } from '../services/schemas/vosk-server.schema';
import { PiperServersController } from '../services/piper-servers.controller';
import { PiperServer, PiperServerSchema } from '../services/schemas/piper-server.schema';
import { FlowiseServersController } from '../services/flowise-servers.controller';
import { FlowiseServer, FlowiseServerSchema } from '../services/schemas/flowise-server.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Flow.name, schema: FlowSchema },
      { name: VoskServer.name, schema: VoskServerSchema },
      { name: PiperServer.name, schema: PiperServerSchema },
      { name: FlowiseServer.name, schema: FlowiseServerSchema },
    ]),
    DevicesModule,
  ],
  controllers: [FlowCoreController, VoskServersController, PiperServersController, FlowiseServersController],
  providers: [
    FlowCoreService, 
    FlowEngine, 
    NodeFactory,
    VoskService,
    PiperService,
    N8nService,
    FlowiseService,
  ],
  exports: [FlowCoreService, FlowEngine, NodeFactory],
})
export class FlowCoreModule {}

