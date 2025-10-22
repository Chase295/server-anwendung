import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { WebSocketGateway } from './websocket.gateway';
import { DebugEventsGateway } from './debug-events.gateway';
import { Device, DeviceSchema } from './schemas/device.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Device.name, schema: DeviceSchema },
    ]),
    AuthModule,
  ],
  controllers: [DevicesController],
  providers: [DevicesService, WebSocketGateway, DebugEventsGateway],
  exports: [DevicesService, WebSocketGateway, DebugEventsGateway],
})
export class DevicesModule {}

