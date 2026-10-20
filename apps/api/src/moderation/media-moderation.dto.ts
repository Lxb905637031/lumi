import { MediaReviewStatus as MediaReviewStatusEnum } from '@prisma/client';
import type { MediaReviewStatus } from '@prisma/client';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorPaginationDto } from '../common/pagination/pagination.dto';

export const mediaReviewKinds = ['PROFILE', 'CLOTHING', 'GENERATION_OUTPUT', 'UPLOAD'] as const;
export type MediaReviewKind = (typeof mediaReviewKinds)[number];

export class MediaReviewQueryDto extends CursorPaginationDto {
  @IsOptional()
  @IsIn(Object.values(MediaReviewStatusEnum))
  status?: MediaReviewStatus;

  @IsOptional()
  @IsIn(mediaReviewKinds)
  kind?: MediaReviewKind;
}

export class UpdateMediaReviewDto {
  @IsIn([MediaReviewStatusEnum.APPROVED, MediaReviewStatusEnum.REJECTED])
  status!: Exclude<MediaReviewStatus, 'UNREVIEWED'>;

  @IsDateString()
  expectedUpdatedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
