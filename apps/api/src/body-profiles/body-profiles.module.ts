import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BodyProfilesController } from './body-profiles.controller';
import { BodyProfilesService } from './body-profiles.service';

@Module({
  imports: [PrismaModule],
  controllers: [BodyProfilesController],
  providers: [BodyProfilesService],
  exports: [BodyProfilesService],
})
export class BodyProfilesModule {}
