import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { CreateBodyProfileDto } from './body-profile.dto';
import { BodyProfilesService } from './body-profiles.service';

@Controller('body-profiles')
@UseGuards(AuthGuard)
export class BodyProfilesController {
  constructor(private readonly profiles: BodyProfilesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBodyProfileDto) {
    return this.profiles.create(user.id, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.profiles.findOwned(user.id, id);
  }
}
