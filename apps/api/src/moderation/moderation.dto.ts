import { ModerationStatus as ModerationStatusEnum } from '@prisma/client';
import type { ModerationStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorPaginationDto } from '../common/pagination/pagination.dto';

const moderationActionStatuses = [
  ModerationStatusEnum.APPROVED,
  ModerationStatusEnum.REJECTED,
  ModerationStatusEnum.REMOVED,
] as const;

export class ModerationQueueQueryDto extends CursorPaginationDto {
  @IsOptional()
  @IsIn(Object.values(ModerationStatusEnum))
  status?: ModerationStatus;
}

export class UpdateModerationStatusDto {
  @IsIn(moderationActionStatuses)
  status!: ModerationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
