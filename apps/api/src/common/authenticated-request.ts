import type { FastifyRequest } from 'fastify';
import type { UserRole } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  openId: string;
  role: UserRole;
};

export type AuthenticatedRequest = FastifyRequest & {
  user: AuthenticatedUser;
};
