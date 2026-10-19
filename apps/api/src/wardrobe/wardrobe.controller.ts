import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { CursorPaginationDto } from '../common/pagination/pagination.dto';
import { CreateClothingItemDto, UpdateClothingItemDto } from './wardrobe.dto';
import { WardrobeService } from './wardrobe.service';

@Controller('wardrobe/items')
@UseGuards(AuthGuard)
export class WardrobeController {
  constructor(private readonly wardrobe: WardrobeService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorPaginationDto) {
    return this.wardrobe.list(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClothingItemDto) {
    return this.wardrobe.create(user.id, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wardrobe.findOwned(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateClothingItemDto) {
    return this.wardrobe.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wardrobe.remove(user.id, id);
  }
}
