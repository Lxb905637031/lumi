import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger, type ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { meta, requestId, type ApiFailure } from './api-response';
import { RuntimeMetricsService } from './runtime-metrics.service';

const statusCodes: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'AUTHENTICATION_REQUIRED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly metrics: RuntimeMetricsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body = typeof raw === 'string' ? { message: raw } : raw && typeof raw === 'object' ? raw : {};
    const messageValue = 'message' in body ? body.message : undefined;
    const message = Array.isArray(messageValue)
      ? messageValue.join('；')
      : typeof messageValue === 'string'
        ? messageValue
        : status >= 500
          ? '服务暂时不可用，请稍后重试'
          : '请求无法完成';
    const details = Array.isArray(messageValue)
      ? { issues: messageValue }
      : 'details' in body
        ? body.details
        : undefined;
    const code =
      'code' in body && typeof body.code === 'string' ? body.code : (statusCodes[status] ?? 'INTERNAL_SERVER_ERROR');
    const id = requestId(request, reply);
    const startedAt = (request as FastifyRequest & { lumiStartedAt?: bigint }).lumiStartedAt;
    this.metrics.recordHttp(status, startedAt ? Number(process.hrtime.bigint() - startedAt) / 1_000_000 : 0);
    if (status >= 500) {
      const errorName =
        exception instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(exception.name)
          ? exception.name
          : 'UNKNOWN_ERROR';
      this.logger.error(
        JSON.stringify({ event: 'http.request.failed', requestId: id, statusCode: status, code, errorName }),
      );
    }
    const failure: ApiFailure = {
      success: false,
      code,
      message,
      ...(details === undefined ? {} : { details }),
      meta: meta(id),
    };
    reply.status(status).send(failure);
  }
}
