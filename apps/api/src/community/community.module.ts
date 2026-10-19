import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [CommunityController],
  providers: [AuthGuard, CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
