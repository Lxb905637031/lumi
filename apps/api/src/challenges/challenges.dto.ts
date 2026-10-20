import { ChallengeStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { CursorPaginationDto } from '../common/pagination/pagination.dto';

export class AdminChallengeQueryDto extends CursorPaginationDto {
  @IsOptional()
  @IsIn(Object.values(ChallengeStatus))
  status?: ChallengeStatus;
}

export class CreateChallengeDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @Length(3, 80)
  slug!: string;

  @IsString()
  @Length(3, 100)
  title!: string;

  @IsString()
  @Length(1, 3000)
  description!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}

export class SetParticipationDto {
  @IsBoolean()
  active!: boolean;
}
