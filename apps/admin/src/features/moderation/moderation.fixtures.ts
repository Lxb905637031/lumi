export type ReviewQueueItem = {
  id: string;
  type: string;
  user: string;
  status: '待审核' | '待处理';
  time: string;
};

export const reviewQueueFixture: ReviewQueueItem[] = [
  {
    id: 'review-1',
    type: '试穿结果',
    user: 'demo-user',
    status: '待审核',
    time: '刚刚',
  },
  {
    id: 'review-2',
    type: '社区帖子',
    user: 'style-seeker',
    status: '待审核',
    time: '8 分钟前',
  },
  {
    id: 'review-3',
    type: '举报内容',
    user: 'anonymous',
    status: '待处理',
    time: '22 分钟前',
  },
];
