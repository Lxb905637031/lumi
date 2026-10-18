import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateBodyProfileDto {
  @IsString()
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
}

export class ConfirmAvatarDto {
  @IsString()
  assetId!: string;
}
