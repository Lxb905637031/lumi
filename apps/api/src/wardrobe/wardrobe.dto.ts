import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class CreateClothingItemDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsString()
  @IsIn(['TOP', 'BOTTOM', 'DRESS'])
  category!: string;

  @IsOptional()
  @IsString()
  assetId?: string;
}
