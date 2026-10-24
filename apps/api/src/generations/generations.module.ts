import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../common/auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { QuotaModule } from '../quota/quota.module';
import { MediaModule } from '../media/media.module';
import { GenerationRecoveryService } from './generation-recovery.service';
import { BullMqGenerationQueueAdapter } from './bullmq-generation-queue.adapter';
import { GenerationsController } from './generations.controller';
import { GENERATION_QUEUE, GENERATION_QUEUE_NAME } from './generation-queue.port';
import { GENERATION_PROVIDER } from './generation-provider.port';
import { GenerationProcessor } from './generation.processor';
import { LocalGenerationProvider } from './local-generation-provider';
import { GenerationsService } from './generations.service';
import { GenerationResultsService } from './generation-results.service';
import { GenerationResultsController } from './generation-results.controller';
import { GenerationSharingController, PublicGenerationSharingController } from './generation-sharing.controller';
import { GenerationSharingService } from './generation-sharing.service';

@Module({
  imports: [
    PrismaModule,
    QuotaModule,
    MediaModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.getOrThrow<string>('REDIS_URL'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password || undefined,
            db: url.pathname ? Number(url.pathname.slice(1)) || undefined : undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: GENERATION_QUEUE_NAME }),
  ],
  controllers: [
    GenerationsController,
    GenerationResultsController,
    GenerationSharingController,
    PublicGenerationSharingController,
  ],
  providers: [
    GenerationsService,
    GenerationResultsService,
    GenerationSharingService,
    AuthGuard,
    BullMqGenerationQueueAdapter,
    GenerationProcessor,
    GenerationRecoveryService,
    LocalGenerationProvider,
    { provide: GENERATION_QUEUE, useExisting: BullMqGenerationQueueAdapter },
    { provide: GENERATION_PROVIDER, useExisting: LocalGenerationProvider },
  ],
})
export class GenerationsModule {}
