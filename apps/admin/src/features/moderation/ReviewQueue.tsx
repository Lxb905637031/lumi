import { reviewQueueFixture } from './moderation.fixtures';

export function ReviewQueue() {
  return (
    <section
      className="mt-6 rounded-lg border border-lumi-line bg-lumi-surface p-5 sm:p-6"
      aria-labelledby="review-queue-title"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold" id="review-queue-title">
          审核队列
        </h2>
        <span className="text-sm text-lumi-muted">{reviewQueueFixture.length} 条</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-lumi-line text-lumi-muted">
              <th className="py-3 pr-4 font-medium">内容</th>
              <th className="py-3 pr-4 font-medium">提交者</th>
              <th className="py-3 pr-4 font-medium">状态</th>
              <th className="py-3 text-right font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            {reviewQueueFixture.map((item) => (
              <tr className="border-b border-lumi-line last:border-b-0" key={item.id}>
                <td className="py-4 pr-4 font-medium">{item.type}</td>
                <td className="py-4 pr-4 text-lumi-muted">{item.user}</td>
                <td className="py-4 pr-4">
                  <span
                    className={
                      item.status === '待审核'
                        ? 'inline-flex rounded-full bg-lumi-brand-soft px-2.5 py-1 text-xs font-medium text-lumi-brand'
                        : 'inline-flex rounded-full bg-lumi-canvas px-2.5 py-1 text-xs font-medium text-lumi-muted'
                    }
                  >
                    {item.status}
                  </span>
                </td>
                <td className="py-4 text-right text-lumi-muted">{item.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
