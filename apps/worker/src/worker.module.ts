import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@lexbridge/database';
import { PDF_EXPORT_QUEUE } from '@lexbridge/shared';
import { PdfExportProcessor } from './pdf.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    DatabaseModule,
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
        maxRetriesPerRequest: null,
      },
    }),
    BullModule.registerQueue({ name: PDF_EXPORT_QUEUE }),
  ],
  providers: [PdfExportProcessor],
})
export class WorkerModule {}
