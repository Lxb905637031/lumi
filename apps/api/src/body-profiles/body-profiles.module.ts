import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { BodyProfilesController } from './body-profiles.controller';
import { BodyProfilesService } from './body-profiles.service';

@Module({
  imports: [PrismaModule],
  controllers: [BodyProfilesController],
  providers: [AuthGuard, BodyProfilesService],
  exports: [BodyProfilesService],
})
export class BodyProfilesModule {}
