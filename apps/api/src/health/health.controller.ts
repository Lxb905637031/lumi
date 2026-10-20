import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@lumi/contracts';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'lumi-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  getMetrics() {
    const memory = process.memoryUsage();
    return {
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
      },
      node: process.version,
      timestamp: new Date().toISOString(),
    };
  }
}
