import { IsInt, IsString, Length, Min } from 'class-validator';
import { CursorPaginationDto } from '../common/pagination/pagination.dto';

export class CreateAnnouncementDto {
  @IsString()
  @Length(8, 128)
  idempotencyKey!: string;

  @IsString()
  @Length(1, 120)
  title!: string;

  @IsString()
  @Length(1, 5000)
  body!: string;
}

export class UpdateAnnouncementDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @Length(1, 120)
  title!: string;

  @IsString()
  @Length(1, 5000)
  body!: string;
}

export class PublishAnnouncementDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class AnnouncementQueryDto extends CursorPaginationDto {}
