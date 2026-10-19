import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { CursorPaginationDto } from '../common/pagination/pagination.dto';
import { CreateGenerationJobDto } from './generation.dto';
import { GenerationsService } from './generations.service';

@Controller('generation-jobs')
@UseGuards(AuthGuard)
export class GenerationsController {
  constructor(private readonly generations: GenerationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorPaginationDto) {
    return this.generations.list(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGenerationJobDto) {
    return this.generations.create(user.id, dto);
  }

  @Post(':id/retry')
  retry(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.generations.retry(user.id, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.generations.cancel(user.id, id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.generations.findOwned(user.id, id);
  }
}
