import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { meta, requestId, type ApiSuccess } from './api-response';

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>> {
    const http = context.switchToHttp();
    const id = requestId(http.getRequest<FastifyRequest>(), http.getResponse<FastifyReply>());
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        code: 'OK' as const,
        message: 'OK' as const,
        data,
        meta: meta(id),
      })),
    );
  }
}
