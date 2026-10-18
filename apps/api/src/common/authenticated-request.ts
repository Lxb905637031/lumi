import type { FastifyRequest } from 'fastify';

export type AuthenticatedUser = {
  id: string;
  openId: string;
};

export type AuthenticatedRequest = FastifyRequest & {
  user: AuthenticatedUser;
};
