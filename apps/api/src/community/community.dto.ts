import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  ArrayUnique,
  ArrayMaxSize,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { CursorPaginationDto } from '../common/pagination/pagination.dto';

export class CreatePostDto {
  @IsString()
  @Length(8, 128)
  idempotencyKey!: string;

  @IsString()
  @Length(1, 120)
  @Matches(/\S/, { message: '标题不能为空白' })
  title!: string;

  @IsString()
  @Length(1, 5000)
  @Matches(/\S/, { message: '正文不能为空白' })
  body!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @ArrayUnique()
  @IsString({ each: true })
  imageAssetIds!: string[];

  @IsOptional()
  @IsString()
  @Length(1, 80)
  topic?: string;

  @IsOptional()
  @IsBoolean()
  isAiGenerated?: boolean;
}

export class SetInteractionDto {
  @IsBoolean()
  active!: boolean;
}

export class SetFollowDto {
  @IsBoolean()
  active!: boolean;
}

export class CreateCommentDto {
  @IsString()
  @Length(1, 1000)
  body!: string;
}

export class ReportPostDto {
  @IsString()
  @IsIn(['SPAM', 'PORNOGRAPHY', 'HARASSMENT', 'COPYRIGHT', 'OTHER'])
  reason!: string;
}

export class CommunityQueryDto extends CursorPaginationDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  topic?: string;
}
