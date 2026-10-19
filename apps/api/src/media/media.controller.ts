import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { CreateMediaAssetDto, ReserveMediaUploadDto } from './media.dto';
import { MediaService } from './media.service';

@Controller('media/assets')
@UseGuards(AuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMediaAssetDto) {
    return this.media.createLocalAsset(user.id, dto);
  }

  @Post('uploads')
  reserveUpload(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReserveMediaUploadDto) {
    return this.media.reserveUpload(user.id, dto);
  }

  @Post(':id/complete')
  completeUpload(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.media.completeUpload(user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.media.removeOwned(user.id, id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.media.findOwned(user.id, id);
  }
}
