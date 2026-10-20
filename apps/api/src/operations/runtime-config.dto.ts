import { IsObject, IsString, Length } from 'class-validator';

export class UpsertRuntimeConfigDto {
  @IsString()
  @Length(2, 80)
  key!: string;

  @IsObject()
  value!: Record<string, unknown>;

  @IsString()
  @Length(1, 240)
  reason!: string;
}

export class RollbackRuntimeConfigDto {
  @IsString()
  @Length(1, 80)
  key!: string;

  @IsString()
  @Length(1, 128)
  expectedCurrentId!: string;

  @IsString()
  @Length(1, 128)
  targetId!: string;

  @IsString()
  @Length(1, 240)
  reason!: string;
}
