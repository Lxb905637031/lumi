const queue = [
  { type: '试穿结果', user: 'demo-user', status: '待审核', time: '刚刚' },
  { type: '社区帖子', user: 'style-seeker', status: '待审核', time: '8 分钟前' },
  { type: '举报内容', user: 'anonymous', status: '待处理', time: '22 分钟前' },
];

export default function App() {
  return (
    <main className="admin-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">LUMI / OPERATIONS</span>
          <h1>内容审核工作台</h1>
        </div>
        <div className="mode-chip">FREE MODE</div>
      </header>
      <section className="metrics">
        <div><span>待审核</span><strong>3</strong></div>
        <div><span>今日生成</span><strong>0</strong></div>
        <div><span>失败任务</span><strong>0</strong></div>
        <div><span>社区帖子</span><strong>0</strong></div>
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>审核队列</h2><button>刷新</button></div>
        <div className="queue">
          {queue.map((item) => (
            <div className="queue-row" key={`${item.type}-${item.user}`}>
              <div><strong>{item.type}</strong><span>{item.user}</span></div>
              <span>{item.status}</span>
              <time>{item.time}</time>
              <button>查看</button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
