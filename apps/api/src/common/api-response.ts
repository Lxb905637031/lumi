import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,96}$/;

export type ApiMeta = {
  requestId: string;
  timestamp: string;
};

export type ApiSuccess<T> = {
  success: true;
  code: 'OK';
  message: 'OK';
  data: T;
  meta: ApiMeta;
};

export type ApiFailure = {
  success: false;
  code: string;
  message: string;
  details?: unknown;
  meta: ApiMeta;
};

export type RequestWithCorrelation = FastifyRequest & { lumiRequestId?: string };

export function ensureRequestId(request: FastifyRequest): string {
  const correlated = request as RequestWithCorrelation;
  if (correlated.lumiRequestId) return correlated.lumiRequestId;
  const header = request.headers['x-request-id'];
  const candidate = Array.isArray(header) ? header[0] : header;
  correlated.lumiRequestId = candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
  return correlated.lumiRequestId;
}

export function requestId(request: FastifyRequest, reply: FastifyReply): string {
  const id = ensureRequestId(request);
  reply.header('x-request-id', id);
  return id;
}

export function meta(id: string): ApiMeta {
  return { requestId: id, timestamp: new Date().toISOString() };
}
