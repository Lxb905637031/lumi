import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [PrismaModule],
  controllers: [MediaController],
  providers: [AuthGuard, MediaService],
  exports: [MediaService],
})
export class MediaModule {}
