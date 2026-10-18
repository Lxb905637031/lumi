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
}

export class ConfirmAvatarDto {
  @IsString()
  assetId!: string;
}
