import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from './authenticated-request';

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
    const token = header.slice('Bearer '.length);
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        openId: string;
      }>(token);
      if (!payload.sub || !payload.openId) throw new UnauthorizedException();
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, wxOpenId: true, role: true, status: true },
      });
      if (!user || user.status !== 'ACTIVE' || user.wxOpenId !== payload.openId) {
        throw new UnauthorizedException();
      }
      request.user = { id: user.id, openId: user.wxOpenId, role: user.role };
    } catch {
      throw new UnauthorizedException('登录状态已失效');
    }
    return true;
  }
}
