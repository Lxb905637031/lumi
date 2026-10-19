import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from './authenticated-request';

type AccessTokenPayload = {
  sub: string;
  openId: string;
  sid: string;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('登录状态已失效');
    }
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(header.slice('Bearer '.length));
    } catch {
      throw new UnauthorizedException('登录状态已失效');
    }
    if (!payload.sub || !payload.openId || !payload.sid) throw new UnauthorizedException();
    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { id: true, wxOpenId: true, role: true, status: true } },
      },
    });
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== 'ACTIVE' ||
      session.user.id !== payload.sub ||
      session.user.wxOpenId !== payload.openId
    ) {
      throw new UnauthorizedException();
    }
    request.user = {
      id: session.user.id,
      openId: session.user.wxOpenId,
      role: session.user.role,
      sessionId: session.id,
    };
    return true;
  }
}
