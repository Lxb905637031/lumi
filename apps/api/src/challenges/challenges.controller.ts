import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateChallengeDto, SetParticipationDto } from './challenges.dto';
import { ChallengesService } from './challenges.service';

@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get()
  list() {
    return this.challenges.list();
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.challenges.get(slug);
  }

  @Get(':slug/participation')
  @UseGuards(AuthGuard)
  participation(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    return this.challenges.myParticipation(user.id, slug);
  }

  @Put(':slug/participation')
  @UseGuards(AuthGuard)
  participate(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string, @Body() dto: SetParticipationDto) {
    return this.challenges.setParticipation(user.id, slug, dto.active);
  }
}

@Controller('admin/challenges')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateChallengeDto) {
    return this.challenges.create(user.id, dto);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.challenges.publish(id);
  }

  @Patch(':id/close')
  close(@Param('id') id: string) {
    return this.challenges.close(id);
  }
}
