import { IsString, Length } from 'class-validator';

export class WechatLoginDto {
  @IsString()
  @Length(1, 128)
  code!: string;
}

export class RefreshTokenDto {
  @IsString()
  @Length(32, 256)
  refreshToken!: string;
}

export class AdminLoginDto {
  @IsString()
  @Length(1, 120)
  username!: string;

  @IsString()
  @Length(12, 256)
  password!: string;
}
