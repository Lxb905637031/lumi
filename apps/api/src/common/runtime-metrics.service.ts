import { Injectable } from '@nestjs/common';

const LATENCY_BUCKETS_MS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000] as const;
export type QueueMetricOutcome = 'started' | 'succeeded' | 'skipped' | 'retrying' | 'dead-letter';

@Injectable()
export class RuntimeMetricsService {
  private httpRequests = 0;
  private readonly httpByStatus = new Map<string, number>();
  private readonly latencyBuckets = new Map<number, number>(LATENCY_BUCKETS_MS.map((bucket) => [bucket, 0]));
  private latencyOverflow = 0;
  private readonly queueEvents = new Map<string, number>();

  recordHttp(statusCode: number, durationMs: number): void {
    this.httpRequests += 1;
    const statusGroup = `${Math.floor(statusCode / 100)}xx`;
    this.httpByStatus.set(statusGroup, (this.httpByStatus.get(statusGroup) ?? 0) + 1);
    const bucket = LATENCY_BUCKETS_MS.find((candidate) => durationMs <= candidate);
    if (bucket === undefined) this.latencyOverflow += 1;
    else this.latencyBuckets.set(bucket, (this.latencyBuckets.get(bucket) ?? 0) + 1);
  }

  recordQueue(queue: 'generation' | 'announcement-delivery', outcome: QueueMetricOutcome): void {
    const key = `${queue}:${outcome}`;
    this.queueEvents.set(key, (this.queueEvents.get(key) ?? 0) + 1);
  }

  snapshot() {
    return {
      scope: 'process-local',
      http: {
        requests: this.httpRequests,
        byStatusGroup: Object.fromEntries(
          [...this.httpByStatus.entries()].sort(([left], [right]) => left.localeCompare(right)),
        ),
        latencyMs: {
          buckets: Object.fromEntries(this.latencyBuckets),
          overflow: this.latencyOverflow,
        },
      },
      queues: Object.fromEntries([...this.queueEvents.entries()].sort(([left], [right]) => left.localeCompare(right))),
    };
  }
}
