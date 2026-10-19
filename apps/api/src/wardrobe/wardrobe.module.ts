import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { WardrobeController } from './wardrobe.controller';
import { WardrobeService } from './wardrobe.service';

@Module({
  imports: [PrismaModule],
  controllers: [WardrobeController],
  providers: [AuthGuard, WardrobeService],
})
export class WardrobeModule {}
