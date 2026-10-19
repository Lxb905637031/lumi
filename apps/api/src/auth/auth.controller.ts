import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthGuard } from '../common/auth.guard';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { AdminLoginDto, RefreshTokenDto, WechatLoginDto } from './auth.dto';
import { AuthService } from './auth.service';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wechat/login')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  login(@Body() dto: WechatLoginDto) {
    return this.authService.login(dto.code);
  }

  @Post('admin/login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto.username, dto.password);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.id, user.sessionId);
  }
}
