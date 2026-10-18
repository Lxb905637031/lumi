import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { CreateClothingItemDto } from './wardrobe.dto';
import { WardrobeService } from './wardrobe.service';

@Controller('wardrobe/items')
@UseGuards(AuthGuard)
export class WardrobeController {
  constructor(private readonly wardrobe: WardrobeService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.wardrobe.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClothingItemDto) {
    return this.wardrobe.create(user.id, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wardrobe.findOwned(user.id, id);
  }
}
