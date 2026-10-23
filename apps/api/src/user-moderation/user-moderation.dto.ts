import { UserRole as UserRoleEnum, UserStatus as UserStatusEnum } from '@prisma/client';
import type { UserRole, UserStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, IsDateString, Matches, MaxLength, MinLength } from 'class-validator';
import { CursorPaginationDto } from '../common/pagination/pagination.dto';

export class UserModerationQueryDto extends CursorPaginationDto {
  @IsOptional()
  @IsIn(Object.values(UserStatusEnum))
  status?: UserStatus;

  @IsOptional()
  @IsIn(Object.values(UserRoleEnum))
  role?: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class UpdateUserModerationDto {
  @IsOptional()
  @IsIn([UserStatusEnum.ACTIVE, UserStatusEnum.SUSPENDED])
  status?: UserStatus;

  @IsOptional()
  @IsIn(Object.values(UserRoleEnum))
  role?: UserRole;

  @IsDateString()
  expectedUpdatedAt!: string;

  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class MuteUserDto {
  @IsDateString()
  expectedUpdatedAt!: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Matches(/\S/, { message: '禁言原因不能为空白' })
  reason!: string;
}
