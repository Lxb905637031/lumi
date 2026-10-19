import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const [pendingPosts, generationToday, failedGenerations, communityPosts, openReports] = await Promise.all([
      this.prisma.post.count({ where: { moderationStatus: 'PENDING', deletedAt: null } }),
      this.prisma.generationJob.count({ where: { createdAt: { gte: dayStart } } }),
      this.prisma.generationJob.count({ where: { status: { in: ['FAILED', 'DEAD_LETTER'] } } }),
      this.prisma.post.count({ where: { deletedAt: null } }),
      this.prisma.postReport.count({ where: { status: 'OPEN' } }),
    ]);
    return { pendingPosts, generationToday, failedGenerations, communityPosts, openReports };
  }
}
