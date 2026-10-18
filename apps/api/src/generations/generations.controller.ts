import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { CreateGenerationJobDto } from './generation.dto';
import { GenerationsService } from './generations.service';

@Controller('generation-jobs')
@UseGuards(AuthGuard)
export class GenerationsController {
  constructor(private readonly generations: GenerationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.generations.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGenerationJobDto) {
    return this.generations.create(user.id, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.generations.findOwned(user.id, id);
  }
}
