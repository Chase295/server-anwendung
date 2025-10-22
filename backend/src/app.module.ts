import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './modules/auth/auth.module';
import { DevicesModule } from './modules/devices/devices.module';
import { FlowCoreModule } from './modules/flow-core/flow-core.module';
import { LogsModule } from './modules/logs/logs.module';

@Module({
  imports: [
    // Config-Modul für .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // MongoDB-Verbindung mit Auto-Reconnect
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot-orchestrator', {
      autoCreate: true,
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }),

    // Feature-Module
    AuthModule,
    DevicesModule,
    FlowCoreModule,
    LogsModule,
  ],
})
export class AppModule {}

