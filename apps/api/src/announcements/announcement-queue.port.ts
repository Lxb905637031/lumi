export const ANNOUNCEMENT_QUEUE = Symbol('ANNOUNCEMENT_QUEUE');
export const ANNOUNCEMENT_QUEUE_NAME = 'announcement-delivery';
export const ANNOUNCEMENT_JOB_NAME = 'deliver-announcement';
export const ANNOUNCEMENT_DELIVERY_BATCH_SIZE = 250;

export type EnqueueAnnouncementCommand = { announcementId: string };

export interface AnnouncementQueue {
  enqueue(command: EnqueueAnnouncementCommand): Promise<void>;
}
