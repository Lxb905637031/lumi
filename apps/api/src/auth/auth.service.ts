import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { verifyPassword } from './password';

type SessionUser = {
  id: string;
  wxOpenId: string;
  role: UserRole;
};

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
      create: { wxOpenId: openId, ...(isLocalAdmin ? { role: UserRole.ADMIN } : {}) },
      update: {},
      select: { id: true, wxOpenId: true, role: true, status: true },
    });
    if (user.status !== 'ACTIVE') throw new UnauthorizedException();
    const tokens = await this.issueSession(user);
    return {
      ...tokens,
      user: { id: user.id, openId: user.wxOpenId, role: user.role },
      freeMode,
    };
  }

  async refresh(refreshToken: string) {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const current = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { id: true, wxOpenId: true, role: true, status: true } },
      },
    });
    const now = new Date();
    if (!current || current.revokedAt || current.expiresAt <= now || current.user.status !== 'ACTIVE') {
      if (current?.revokedAt) await this.revokeActiveSessions(current.userId);
      throw new UnauthorizedException();
    }

    const rotated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.userSession.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: now, lastUsedAt: now },
      });
      if (claimed.count !== 1) {
        return { replayDetected: true as const };
      }

      const replacement = await this.createSession(tx, current.user);
      await tx.userSession.update({
        where: { id: current.id },
        data: { replacedBySessionId: replacement.sessionId },
      });
      return {
        replayDetected: false as const,
        ...replacement.tokens,
        user: { id: current.user.id, openId: current.user.wxOpenId, role: current.user.role },
        freeMode: this.config.getOrThrow<string>('FREE_MODE') === 'true',
      };
    });
    if (rotated.replayDetected) {
      await this.revokeActiveSessions(current.userId);
      throw new UnauthorizedException();
    }
    return {
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      refreshTokenExpiresAt: rotated.refreshTokenExpiresAt,
      user: rotated.user,
      freeMode: rotated.freeMode,
    };
  }

  async adminLogin(username: string, password: string) {
    const credential = await this.prisma.adminCredential.findUnique({
      where: { username },
      select: {
        passwordHash: true,
        disabledAt: true,
        user: { select: { id: true, wxOpenId: true, role: true, status: true } },
      },
    });
    const passwordValid = await verifyPassword(password, credential?.passwordHash);
    if (!credential || credential.disabledAt || credential.user.status !== 'ACTIVE' || !passwordValid) {
      throw new UnauthorizedException('账号或密码错误');
    }
    if (credential.user.role !== UserRole.ADMIN && credential.user.role !== UserRole.MODERATOR) {
      throw new UnauthorizedException('账号或密码错误');
    }
    const tokens = await this.issueSession(credential.user);
    return {
      ...tokens,
      user: { id: credential.user.id, openId: credential.user.wxOpenId, role: credential.user.role },
      freeMode: this.config.getOrThrow<string>('FREE_MODE') === 'true',
    };
  }

  async logout(userId: string, sessionId: string) {
    const now = new Date();
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: now, lastUsedAt: now },
    });
    return { success: true };
  }

  private async issueSession(user: SessionUser): Promise<SessionTokens> {
    const { tokens } = await this.createSession(this.prisma, user);
    return tokens;
  }

  private async createSession(
    client: Prisma.TransactionClient | PrismaService,
    user: SessionUser,
  ): Promise<{ sessionId: string; tokens: SessionTokens }> {
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenExpiresAt = this.getRefreshTokenExpiry();
    const session = await client.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: refreshTokenExpiresAt,
      },
      select: { id: true },
    });
    return {
      sessionId: session.id,
      tokens: {
        accessToken: await this.signAccessToken(user, session.id),
        refreshToken,
        refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
      },
    };
  }

  private signAccessToken(user: SessionUser, sessionId: string) {
    return this.jwt.signAsync({ openId: user.wxOpenId, sid: sessionId }, { subject: user.id });
  }

  private getRefreshTokenExpiry() {
    const days = this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private hashRefreshToken(refreshToken: string) {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private async revokeActiveSessions(userId: string) {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
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
      if (!result.openid) {
        this.logger.warn(`WeChat login rejected with errcode=${result.errcode ?? 'unknown'}`);
        throw new UnauthorizedException();
      }
      return result.openid;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error('WeChat login provider unavailable', error);
      throw new ServiceUnavailableException('微信登录服务暂时不可用');
    }
  }
}
