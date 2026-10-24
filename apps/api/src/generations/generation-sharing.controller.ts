import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { GenerationSharingService } from './generation-sharing.service';

class ResolveGenerationShareDto {
  @IsString()
  @Length(32, 128)
  token!: string;
}

@Controller('generation-jobs/:id/outputs/:outputId/shares')
@UseGuards(AuthGuard)
export class GenerationSharingController {
  constructor(private readonly sharing: GenerationSharingService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Param('id') jobId: string, @Param('outputId') outputId: string) {
    return this.sharing.create(user.id, jobId, outputId);
  }
}

@Controller('generation-shares')
export class PublicGenerationSharingController {
  constructor(private readonly sharing: GenerationSharingService) {}

  @Post('resolve')
  read(@Body() dto: ResolveGenerationShareDto) {
    return this.sharing.read(dto.token);
  }

  @Delete(':shareId')
  @UseGuards(AuthGuard)
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('shareId') shareId: string) {
    return this.sharing.revoke(user.id, shareId);
  }
}
