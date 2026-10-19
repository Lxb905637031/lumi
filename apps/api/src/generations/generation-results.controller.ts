import { Controller, Delete, Param, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { GenerationResultsService } from './generation-results.service';

@Controller('generation-jobs/:id/outputs/:outputId')
@UseGuards(AuthGuard)
export class GenerationResultsController {
  constructor(private readonly results: GenerationResultsService) {}

  @Put('selection')
  select(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('outputId') outputId: string) {
    return this.results.apply(user.id, id, outputId, 'select');
  }

  @Put('saved')
  save(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('outputId') outputId: string) {
    return this.results.apply(user.id, id, outputId, 'save');
  }

  @Delete('saved')
  unsave(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('outputId') outputId: string) {
    return this.results.apply(user.id, id, outputId, 'unsave');
  }

  @Delete()
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('outputId') outputId: string) {
    return this.results.apply(user.id, id, outputId, 'delete');
  }
}
