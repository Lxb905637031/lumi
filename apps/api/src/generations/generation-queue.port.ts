export const GENERATION_QUEUE = Symbol('GENERATION_QUEUE');
export const GENERATION_QUEUE_NAME = 'generation';
export const GENERATION_JOB_NAME = 'generate-try-on';

export type EnqueueGenerationCommand = {
  jobId: string;
  userId: string;
  profileVersionId: string;
  clothingAssetId: string;
  /** Absent only on queue records written before quota migrations. */
  quotaAttempt?: number;
  /** Optional for compatibility with queue records created before correlation was added. */
  requestId?: string;
  workflowId?: string;
};

export interface GenerationQueue {
  enqueue(command: EnqueueGenerationCommand): Promise<void>;
  retry(command: EnqueueGenerationCommand): Promise<void>;
  cancel(jobId: string, quotaAttempt?: number): Promise<void>;
}
