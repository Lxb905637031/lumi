import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(code: string) {
    const freeMode = this.config.getOrThrow<string>('FREE_MODE') === 'true';
    const openId = freeMode ? this.getLocalOpenId(code) : await this.exchangeWechatCode(code);
    const isLocalAdmin = freeMode && this.isConfiguredLocalAdmin(openId);
    const user = await this.prisma.user.upsert({
      where: { wxOpenId: openId },
      create: { wxOpenId: openId },
      update: { status: 'ACTIVE', ...(isLocalAdmin ? { role: UserRole.ADMIN } : {}) },
      select: { id: true, wxOpenId: true, role: true },
    });
    const accessToken = await this.jwt.signAsync({ openId: user.wxOpenId }, { subject: user.id });
    return {
      accessToken,
      user: { id: user.id, openId: user.wxOpenId, role: user.role },
      freeMode,
    };
  }

  private isConfiguredLocalAdmin(openId: string): boolean {
    return this.config
      .getOrThrow<string>('LOCAL_ADMIN_OPEN_IDS')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .includes(openId);
  }

  private getLocalOpenId(code: string) {
    if (!code.startsWith('local:') || code.length <= 'local:'.length) {
      throw new UnauthorizedException('本地免费模式请使用 local:<user-id> 登录');
    }
    return code.slice('local:'.length);
  }

  private async exchangeWechatCode(code: string): Promise<string> {
    const appId = this.config.get<string>('WECHAT_APP_ID');
    const appSecret = this.config.get<string>('WECHAT_APP_SECRET');
    if (!appId || !appSecret) throw new ServiceUnavailableException('微信登录尚未配置');

    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.search = new URLSearchParams({
      appid: appId,
      secret: appSecret,
      js_code: code,
      grant_type: 'authorization_code',
    }).toString();

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`WeChat returned ${response.status}`);
      const result = (await response.json()) as {
        openid?: string;
        errcode?: number;
      };
      if (!result.openid) throw new UnauthorizedException(`微信登录失败（${result.errcode ?? 'unknown'}）`);
      return result.openid;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ServiceUnavailableException('微信登录服务暂时不可用');
    }
  }
}
