import { IsBase64, IsIn, IsString, Length, MaxLength } from 'class-validator';

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
