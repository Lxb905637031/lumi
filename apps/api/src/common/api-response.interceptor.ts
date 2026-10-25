import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from '@nestjs/common';
import { map, tap, type Observable } from 'rxjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { meta, requestId, type ApiSuccess } from './api-response';
import { RuntimeMetricsService } from './runtime-metrics.service';

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  constructor(private readonly metrics: RuntimeMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest & { lumiStartedAt?: bigint }>();
    const reply = http.getResponse<FastifyReply>();
    const id = requestId(request, reply);
    request.lumiStartedAt = process.hrtime.bigint();
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        code: 'OK' as const,
        message: 'OK' as const,
        data,
        meta: meta(id),
      })),
      tap({ next: () => this.metrics.recordHttp(reply.statusCode, this.durationMs(request.lumiStartedAt)) }),
    );
  }

  private durationMs(startedAt?: bigint): number {
    return startedAt ? Number(process.hrtime.bigint() - startedAt) / 1_000_000 : 0;
  }
}
