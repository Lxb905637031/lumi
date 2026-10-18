import { IsString, Length } from 'class-validator';

export class CreateGenerationJobDto {
  @IsString()
  @Length(1, 128)
  profileVersionId!: string;

  @IsString()
  @Length(1, 128)
  clothingAssetId!: string;

  @IsString()
  @Length(8, 128)
  idempotencyKey!: string;
}
