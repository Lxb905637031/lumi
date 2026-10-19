import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { GenerationsController } from './generations.controller';
import { GENERATION_QUEUE } from './generation-queue.port';
import { MockGenerationQueueAdapter } from './mock-generation-queue.adapter';
import { GenerationsService } from './generations.service';

@Module({
  imports: [PrismaModule],
  controllers: [GenerationsController],
  providers: [
    GenerationsService,
    AuthGuard,
    MockGenerationQueueAdapter,
    { provide: GENERATION_QUEUE, useExisting: MockGenerationQueueAdapter },
  ],
})
export class GenerationsModule {}
