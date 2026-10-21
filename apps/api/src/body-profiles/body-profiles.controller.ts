import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { CursorPaginationDto } from '../common/pagination/pagination.dto';
import { CreateBodyProfileDto, UpdateBodyProfileDto } from './body-profile.dto';
import { BodyProfilesService } from './body-profiles.service';

@Controller('body-profiles')
@UseGuards(AuthGuard)
export class BodyProfilesController {
  constructor(private readonly profiles: BodyProfilesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorPaginationDto) {
    return this.profiles.list(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBodyProfileDto) {
    return this.profiles.create(user.id, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.profiles.findOwned(user.id, id);
  }

  @Get(':id/versions')
  listVersions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query() query: CursorPaginationDto) {
    return this.profiles.listVersions(user.id, id, query);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateBodyProfileDto) {
    return this.profiles.update(user.id, id, dto);
  }

  @Delete(':id')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.profiles.archive(user.id, id);
  }
}
