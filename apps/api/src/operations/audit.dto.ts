import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorPaginationDto } from '../common/pagination/pagination.dto';

export const auditTypes = ['POST', 'COMMENT', 'MEDIA', 'USER'] as const;
export type AuditType = (typeof auditTypes)[number];

export class AuditQueryDto extends CursorPaginationDto {
  @IsOptional()
  @IsIn(auditTypes)
  type?: AuditType;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  actorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  targetId?: string;
}
