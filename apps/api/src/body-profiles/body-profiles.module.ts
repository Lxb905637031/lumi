import { Module } from '@nestjs/common';
import { BodyProfilesController } from './body-profiles.controller';
import { BodyProfilesService } from './body-profiles.service';

@Module({
  controllers: [BodyProfilesController],
  providers: [BodyProfilesService],
  exports: [BodyProfilesService],
})
export class BodyProfilesModule {}
