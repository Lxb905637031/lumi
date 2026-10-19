import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../src/common/auth.guard';
import type { AuthenticatedRequest } from '../src/common/authenticated-request';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword, verifyPassword } from '../src/auth/password';

async function guardFixture(
  options: { databaseError?: Error; revoked?: boolean; status?: string; invalidToken?: boolean } = {},
) {
  const session = {
    id: 'session-1',
    userId: 'user-1',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: options.revoked ? new Date() : null,
    user: { id: 'user-1', wxOpenId: 'openid-1', role: 'USER', status: options.status ?? 'ACTIVE' },
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      {
        provide: JwtService,
        useValue: {
          verifyAsync: async () => {
            if (options.invalidToken) throw new Error('invalid token');
            return { sub: 'user-1', sid: 'session-1', openId: 'openid-1' };
          },
        },
      },
      {
        provide: PrismaService,
        useValue: {
          userSession: {
            findUnique: async () => {
              if (options.databaseError) throw options.databaseError;
              return session;
            },
          },
        },
      },
      {
        provide: AuthGuard,
        useFactory: (jwt: JwtService, prisma: PrismaService) => new AuthGuard(jwt, prisma),
        inject: [JwtService, PrismaService],
      },
    ],
  }).compile();
  const request = { headers: { authorization: 'Bearer fixture-token' } } as AuthenticatedRequest;
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  return { moduleRef, guard: moduleRef.get(AuthGuard), request, context };
}

test('auth guard attaches identity and current database role for a valid session', async (t) => {
  const fixture = await guardFixture();
  t.after(() => fixture.moduleRef.close());
  assert.equal(await fixture.guard.canActivate(fixture.context), true);
  assert.deepEqual(fixture.request.user, { id: 'user-1', openId: 'openid-1', role: 'USER', sessionId: 'session-1' });
});

test('auth guard rejects invalid tokens, revoked sessions and suspended users', async (t) => {
  for (const options of [{ invalidToken: true }, { revoked: true }, { status: 'SUSPENDED' }]) {
    const fixture = await guardFixture(options);
    t.after(() => fixture.moduleRef.close());
    await assert.rejects(() => fixture.guard.canActivate(fixture.context), UnauthorizedException);
    assert.equal(fixture.request.user, undefined);
  }
});

test('database outage is not misreported as an invalid login', async (t) => {
  const databaseError = new Error('database unavailable');
  const fixture = await guardFixture({ databaseError });
  t.after(() => fixture.moduleRef.close());
  await assert.rejects(
    () => fixture.guard.canActivate(fixture.context),
    (error) => error === databaseError,
  );
});

test('passwords use independent salts and verify without accepting malformed hashes', async () => {
  const password = 'test-only-password-123';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
  assert.equal(await verifyPassword(password, 'malformed'), false);
  assert.equal(await verifyPassword(password), false);
});
