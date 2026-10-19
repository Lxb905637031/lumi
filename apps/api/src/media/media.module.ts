import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { OBJECT_STORAGE } from './object-storage.port';
import { S3ObjectStorageAdapter } from './s3-object-storage.adapter';
import { ObjectCleanupService } from './object-cleanup.service';

@Module({
  imports: [PrismaModule],
  controllers: [MediaController],
  providers: [
    AuthGuard,
    MediaService,
    S3ObjectStorageAdapter,
    ObjectCleanupService,
    { provide: OBJECT_STORAGE, useExisting: S3ObjectStorageAdapter },
  ],
  exports: [MediaService],
})
export class MediaModule {}
