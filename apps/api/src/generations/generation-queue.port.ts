export const GENERATION_QUEUE = Symbol('GENERATION_QUEUE');

export type EnqueueGenerationCommand = {
  jobId: string;
  userId: string;
};

export interface GenerationQueue {
  enqueue(command: EnqueueGenerationCommand): Promise<void>;
}
