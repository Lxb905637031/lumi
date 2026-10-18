import { IsString, Length } from 'class-validator';

export class WechatLoginDto {
  @IsString()
  @Length(1, 128)
  code!: string;
}
