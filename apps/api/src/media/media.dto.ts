import { IsBase64, IsIn, IsInt, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { MAX_IMAGE_BYTES } from './image-sanitizer';

export class CreateMediaAssetDto {
  @IsString()
  @Length(1, 160)
  fileName!: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  mimeType!: 'image/jpeg' | 'image/png' | 'image/webp';

  @IsString()
  @IsBase64()
  @MaxLength(7_000_000)
  base64!: string;
}

export class ReserveMediaUploadDto {
  @IsString()
  @Length(1, 160)
  fileName!: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  mimeType!: 'image/jpeg' | 'image/png' | 'image/webp';

  @IsInt()
  @Min(1)
  @Max(MAX_IMAGE_BYTES)
  byteSize!: number;

  @IsString()
  @Length(12, 100)
  idempotencyKey!: string;
}
