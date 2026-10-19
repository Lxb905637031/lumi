import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateBodyProfileDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(80)
  @Max(240)
  heightCm?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(250)
  weightKg?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(100)
  shoulderCm?: number;

  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(180)
  bustCm?: number;

  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(180)
  waistCm?: number;

  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(200)
  hipCm?: number;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  sourceAssetId?: string;
}

export class UpdateBodyProfileDto extends CreateBodyProfileDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ConfirmAvatarDto {
  @IsString()
  assetId!: string;
}
