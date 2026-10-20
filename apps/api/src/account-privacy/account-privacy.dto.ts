import { IsString, Length } from 'class-validator';

export class CreateDataExportDto {
  @IsString()
  @Length(1, 64)
  confirmation!: string;
}
