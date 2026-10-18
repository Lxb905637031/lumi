import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WardrobeController } from './wardrobe.controller';
import { WardrobeService } from './wardrobe.service';

@Module({
  imports: [PrismaModule],
  controllers: [WardrobeController],
  providers: [WardrobeService],
})
export class WardrobeModule {}
