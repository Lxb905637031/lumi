import { Body, Controller, Post } from '@nestjs/common';
import { WechatLoginDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wechat/login')
  login(@Body() dto: WechatLoginDto) {
    return this.authService.login(dto.code);
  }
}
