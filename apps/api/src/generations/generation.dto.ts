import { IsString, Length } from 'class-validator';

export class CreateGenerationJobDto {
  @IsString()
  profileVersionId!: string;

  @IsString()
  clothingAssetId!: string;

  @IsString()
  @Length(8, 128)
  idempotencyKey!: string;
}
