export type QueueCorrelation = {
  requestId?: string;
  workflowId?: string;
};

export function queueEvent(input: {
  event: string;
  queue: string;
  bullJobId?: string;
  requestId?: string;
  workflowId: string;
  attempt?: number;
  outcome?: string;
  errorCode?: string;
}): string {
  return JSON.stringify({
    event: input.event,
    queue: input.queue,
    ...(input.bullJobId ? { bullJobId: input.bullJobId } : {}),
    requestId: input.requestId ?? 'legacy-or-recovery',
    workflowId: input.workflowId,
    ...(input.attempt === undefined ? {} : { attempt: input.attempt }),
    ...(input.outcome ? { outcome: input.outcome } : {}),
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
  });
}

export function safeErrorCode(error: unknown): string {
  const name = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
  return /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(name) ? name : 'QUEUE_PROCESSING_ERROR';
}
