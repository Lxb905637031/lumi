/* Static review fixture only. No API calls, credentials or production UI imports. */
const params = new URLSearchParams(location.search);
const theme = ['a', 'b', 'c'].includes(params.get('theme')) ? params.get('theme') : 'b';
const section = params.get('section') || 'core';
const photos = {
  look: 'photo-1539109136881-3be0616acf4b',
  street: 'photo-1483985988355-763728e1935b',
  neutral: 'photo-1483985988355-763728e1935b',
  portrait: 'photo-1534528741775-53994a69daeb',
  shirt: 'photo-1596755094514-f87e34085b2c',
  denim: 'photo-1542272604-787c3835535d',
  dress: 'photo-1595777457583-95e059d581b8',
  tee: 'photo-1521572163474-6864f9cf17ab',
};
const photo = (key) => `https://images.unsplash.com/${photos[key] || photos.look}?auto=format&fit=crop&w=640&q=80`;
const icon = (name) =>
  `<svg class="icon" aria-hidden="true"><use href="./assets/lucide-icons.svg#${name}"></use></svg>`;
const img = (key, alt, cls = '') => `<img class="${cls}" src="${photo(key)}" alt="${alt}" loading="eager" />`;
const pill = (text, cls = '', glyph = '') => `<span class="pill ${cls}">${glyph ? icon(glyph) : ''}${text}</span>`;
const btn = (text, cls = '', target = '') =>
  `<button class="btn ${cls}" ${target ? `data-go="${target}"` : 'data-demo'}>${text}</button>`;
const heading = (title, sub = '', extra = '') =>
  `<div class="page-heading"><div><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div>${extra}</div>`;
const sh = (title, link = '') =>
  `<div class="section-head"><h2>${title}</h2>${link ? `<span class="text-link">${link}</span>` : ''}</div>`;
const note = (text, cls = '') => `<div class="note-box ${cls}">${text}</div>`;
const privacy = (text = '人物照片和身体参数仅自己可见') => `<p class="privacy-note">${icon('lock-keyhole')}${text}</p>`;
const chips = (labels, active = 0) =>
  `<div class="chips">${labels.map((label, i) => `<button class="chip ${i === active ? 'active' : ''}" data-chip>${label}</button>`).join('')}</div>`;
const field = (label, value, unit = '') =>
  `<div class="field"><label>${label}${unit ? '<span>选填</span>' : ''}</label><div class="input">${value}<span class="unit">${unit}</span></div></div>`;
const row = (title, sub = '', end = '', key = '', glyph = '') =>
  `<div class="row">${key ? img(key, title, 'row-image') : glyph ? icon(glyph) : ''}<div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${end || icon('chevron-right')}</div>`;
const avatar = () => img('portrait', '示例用户头像', 'avatar');
const tabs = (active) =>
  `<nav class="bottom-tabs" aria-label="样稿导航">${[
    ['发现', 'house', 1],
    ['衣橱', 'shirt', 3],
    ['试穿', 'grid-2x2', 2],
    ['我的', 'user-round', 4],
  ]
    .map(
      ([label, glyph, id]) =>
        `<button class="${label === active ? 'active' : ''}" data-go="${id}">${icon(glyph)}${label}</button>`,
    )
    .join('')}</nav>`;
const product = (key = 'shirt', name = '浅蓝棉质衬衫', selected = false) =>
  `<div class="product ${selected ? 'selected' : ''}"><div class="product-visual">${img(key, name)}<span class="selection">${selected ? icon('check') : ''}</span></div><p>${name}</p><span class="meta">${key === 'denim' ? '下装' : key === 'dress' ? '连衣裙' : '上装'} · 我的衣橱</span></div>`;
const look = (key = 'look', title = '把基础款穿得更好看', short = false) =>
  `<div class="look ${short ? 'short' : ''}"><figure>${img(key, title, 'look-image')}<figcaption>${title}</figcaption></figure><button class="save" data-demo aria-label="收藏示意">${icon('bookmark')}</button><div class="look-meta"><span class="author">${avatar()}Lin</span><span>${icon('heart')} 128</span></div></div>`;
const feed = () =>
  `<div class="feed"><div class="feed-col">${look('look', '周末的轻松层次')}${look('street', '简单，也很好看', true)}</div><div class="feed-col">${look('street', '一件衬衫的日常', true)}${look('look', '今天想穿得自在一点')}</div></div>`;
const person = () =>
  `<div class="person-choice">${img('look', '人物照片示例')}<div><h3>我的人物档案</h3><p class="muted">版本 03 · 10 月 18 日更新</p>${pill('已确认', '', 'check')}</div>${icon('chevron-right')}</div>`;
const pair = () =>
  `<div class="asset-pair"><div><div class="photo-panel">${img('look', '人物照片示例')}${pill('人物 · v03')}</div><p>我的人物档案</p></div><div><div class="photo-panel">${img('shirt', '浅蓝棉质衬衫')}${pill('衣物 · 单件')}</div><p>浅蓝棉质衬衫</p></div></div>`;
const result = (t) =>
  `${t === 'c' ? '<div class="editorial-kicker">YOUR PERSONAL FIT / 01</div>' : ''}<div class="result-photo">${img('look', '设计效果示意，非真实 AI 生成')}${pill('仅自己可见', '', 'lock-keyhole')}<span class="image-notice">效果示意</span></div><div class="result-context"><div><h2>这一套，你觉得怎么样？</h2><p>人物 v03 · 浅蓝棉质衬衫</p></div>${img('shirt', '原始衣物')}</div>${privacy('确认后可云端保存，公开发布需另行确认')}`;
const state = (title, text, glyph = 'check', cls = '') =>
  `<div class="center-state ${cls}"><div class="state-icon">${icon(glyph)}</div><h2>${title}</h2><p>${text}</p></div>`;
const rules = (items) =>
  `<div class="rule-list">${items.map((text) => `<div class="rule">${icon('check')}<span>${text}</span></div>`).join('')}</div>`;
const summary = () =>
  `<div class="asset-summary"><div><strong>24</strong><span>我的衣物</span></div><div><strong>08</strong><span>保存的搭配</span></div><div><strong>03</strong><span>可用试穿次数</span></div></div>`;
function discovery(t) {
  if (t === 'a')
    return `${heading('发现穿搭', '从日常穿着里，找到新想法', icon('search'))}${chips(['为你推荐', '通勤', '周末', '基础款'])}${feed()}`;
  if (t === 'c')
    return `<div class="editorial-kicker">LUMI JOURNAL / OCTOBER</div><div class="editorial-title">日常，有自己的风格。</div><div class="hero-look">${img('look', '周末穿搭示例')}<div class="hero-shade"></div><div class="hero-meta"><h2>少一点，<br>刚刚好。</h2><p>周末的轻松层次 · Lin</p></div></div>${sh('从衣橱开始', '查看单品')}${chips(['为你推荐', '通勤', '周末'])}${feed()}`;
  return `${heading('今天，怎么穿？', '从你的衣橱里找一点新灵感')}${summary()}<div class="task-resume">${img('look', '待确认的搭配')}<div><strong>上次的试穿，可以继续了</strong><p>1 个结果待确认 · 仅自己可见</p></div>${icon('chevron-right')}</div>${sh('你的常穿单品', '全部 24 件')}<div class="wardrobe-tease">${product('shirt', '浅蓝衬衫')}${product('denim', '直筒牛仔裤')}${product('tee', '白色 T 恤')}</div><div class="discover-products">${sh('穿搭灵感', '更多')}${feed()}</div>`;
}
function tryon(t) {
  const intro = heading('试穿工作台', '选好人物和一件衣物，再看看搭配效果');
  if (t === 'c')
    return `${intro}<div class="editorial-kicker">01 / YOUR STARTING POINT</div>${pair()}${sh('本次人物', '更换')}${person()}${sh('本次使用')}${row('1 次免费试穿', '确认提交后预留，失败自动返还', pill('剩余 3 次'))}${privacy()}`;
  if (t === 'a')
    return `${intro}<div class="step-label"><b>1</b>选择人物</div>${person()}<div class="step-label"><b>2</b>选一件衣物</div><div class="products">${product('shirt', '浅蓝棉质衬衫', true)}${product('tee', '白色棉质 T 恤')}</div>${sh('本次试穿', '更换衣物')}<div class="quota-line"><span>预留 1 次，成功后扣除</span><strong>可用 3 次</strong></div>${privacy()}`;
  return `${intro}<div class="step-label"><b>1</b>人物档案</div>${person()}<div class="step-label"><b>2</b>选择单件衣物 <span class="muted">已选 1 件</span></div>${chips(['全部', '上装', '下装', '连衣裙'])}<div class="products three">${product('shirt', '浅蓝衬衫', true)}${product('tee', '白色 T 恤')}${product('denim', '直筒牛仔裤')}</div><div class="quota-line"><span>本次预留 1 次</span><strong>可用 3 次</strong></div>${privacy('上传与保存资料不消耗试穿次数')}`;
}

const screens = [
  {
    id: 1,
    title: '发现',
    group: 1,
    tab: '发现',
    body: discovery,
    note: '图片、衣橱和继续入口的三种层级方案；示例内容。',
  },
  {
    id: 2,
    title: '试穿工作台',
    group: 1,
    tab: '试穿',
    body: tryon,
    bottom: () => btn('下一步 · 确认试穿', '', 17),
    note: '显式选择人物版本和单件衣物，不自动消耗额度。',
  },
  {
    id: 3,
    title: '我的衣橱',
    group: 1,
    tab: '衣橱',
    body: () =>
      `${heading('我的衣橱 <span class="count">24 件</span>', '穿过、喜欢的衣服，都在这里', `<button class="icon-btn" data-go="14" aria-label="添加衣物">${icon('plus')}</button>`)}<div class="search">${icon('search')}搜索衣物名称${icon('sliders-horizontal')}</div>${chips(['全部 24', '上装 12', '下装 8', '连衣裙 4'])}<div class="products">${product('shirt', '浅蓝棉质衬衫')}${product('denim', '直筒牛仔裤')}${product('tee', '白色棉质 T 恤')}${product('dress', '日常连衣裙')}</div>`,
    note: '分类与单品图优先；不加入电商价格和无关促销。',
  },
  {
    id: 4,
    title: '我的',
    group: 1,
    tab: '我的',
    body: () =>
      `<div class="profile-intro">${img('portrait', '示例头像', 'avatar large')}<div><h1>Lin 的衣橱</h1><p class="muted">慢慢找到，适合自己的风格。</p></div></div><div class="profile-stats"><div><b>12</b><span>发布</span></div><div><b>36</b><span>关注</span></div><div><b>128</b><span>粉丝</span></div></div><div class="profile-banner">${icon('shirt')}<div><h3>人物档案已准备好</h3><p>版本 03 · 照片和参数私有</p></div>${icon('chevron-right')}</div>${row('我的衣橱', '24 件衣物', '', '', 'shirt')}${row('试穿记录', '1 个结果待确认', '', '', 'clock')}${row('我的发布与收藏', '', '', '', 'bookmark')}${row('消息', '', pill('3'), '', 'bell')}${row('隐私与账号', '', '', '', 'shield-check')}`,
    note: '高频资产与信任入口分组，不把低频表单堆在首页。',
  },
  {
    id: 5,
    title: '穿搭详情',
    group: 1,
    body: () =>
      `<div class="post-hero">${img('look', '穿搭内容示例')}</div><div class="post-author"><span class="author">${avatar()}Lin</span>${btn('关注', 'compact secondary')}</div><h2 class="post-title">周末，穿得轻松一点</h2><p class="post-copy">用一件熟悉的衬衫，搭配简单的下装。没有特别的安排，也可以认真对待今天。</p><p class="inline-tags">#周末穿搭 #我的日常衣橱</p>${sh('评论 12', '查看全部')}${row('Mia', '这种简单的搭配很舒服', '', 'portrait')}`,
    bottom: () =>
      `<div class="comment-compose"><div class="input">说说你的搭配想法…</div><span>${icon('heart')}128</span><span>${icon('bookmark')}36</span></div>`,
    note: '图片—作者—正文—评论；审核、删除与举报有独立状态。',
  },
  {
    id: 6,
    title: '我的发布',
    group: 1,
    body: () =>
      `${heading('我的发布', '草稿和审核进度，在这里继续')}${chips(['全部', '待审核 1', '已发布 12'])}<div class="task-resume">${icon('clock')}<div><strong>有 1 篇未完成的草稿</strong><p>浅蓝衬衫的日常 · 刚刚保存</p></div>${icon('chevron-right')}</div>${row('周末，穿得轻松一点', '今天 10:24 · 2 张图片', pill('待审核', 'warn'), 'look')}${row('一件衬衫的日常', '10 月 18 日 · 128 次浏览', pill('已发布'), 'street')}${row('试试另一种搭配', '10 月 16 日 · 查看修改建议', pill('需修改', 'danger'), 'look')}`,
    bottom: () => btn('发布新的穿搭', '', 21),
    note: '待审和被拒内容仅作者可见；保留修改与再次发布入口。',
  },
  {
    id: 7,
    title: '我的收藏',
    group: 1,
    body: () => `${heading('我的收藏', '留住你想试试的搭配')}${chips(['穿搭 36', '试穿结果 8'])}${feed()}`,
    note: '社区收藏与私有试穿结果明确分开；内容失效有退路。',
  },
  {
    id: 8,
    title: '消息',
    group: 1,
    body: () =>
      `${heading('消息', '与你有关的每一次更新', '<span class="text-link">全部已读</span>')}${chips(['全部', '互动', '关注', '系统'])}${row('你的试穿结果准备好了', '浅蓝棉质衬衫 · 3 分钟前', pill('未读'), 'look')}${row('Mia 开始关注你', '10 分钟前', btn('回关', 'compact secondary'), 'portrait')}${row('Sora 评论了你的穿搭', '“这件衬衫的颜色很适合你” · 1 小时前', '', 'street')}${row('发布审核已通过', '周末，穿得轻松一点 · 昨天', '', '', 'shield-check')}${row('数据导出已准备好', '请在有效期内查看 · 昨天', '', '', 'lock-keyhole')}`,
    note: '三类消息、未读、定位与失效恢复；互动消息为拟补能力。',
  },
  {
    id: 9,
    title: '人物档案',
    group: 2,
    body: () =>
      `${heading('人物档案', '用于你主动发起的试穿')}<div class="photo-panel tall">${img('look', '人物资料照片示例')}${pill('当前版本 03', '', 'check')}<span class="photo-edit">更换照片</span></div>${privacy()}<div class="field-grid">${field('身高', '168', 'cm')}${field('体重', '53', 'kg')}</div>${row('身体参数', '肩宽、胸围、腰围、臀围')}${row('历史版本', '查看之前的资料')}`,
    bottom: () => btn('编辑人物资料', '', 10),
    note: '默认私有；更改资料会产生新版本，不改变历史任务。',
  },
  {
    id: 10,
    title: '编辑资料',
    group: 2,
    body: () =>
      `${heading('更新你的资料', '填写真实尺寸，身体参数可以稍后补充')}${person()}${field('档案名称', '我的人物档案')}<div class="field-grid">${field('身高', '168', 'cm')}${field('体重', '53', 'kg')}${field('肩宽', '39', 'cm')}${field('胸围', '86', 'cm')}${field('腰围', '68', 'cm')}${field('臀围', '92', 'cm')}</div>${privacy('保存资料不会触发生成或扣除试穿次数')}<span class="text-link">不知道怎么量？查看测量指引</span>`,
    bottom: () => btn('保存新版本', '', 9),
    note: '单位固定、字段就地校验；冲突时保留输入而非覆盖。',
  },
  {
    id: 11,
    title: '测量指引',
    group: 2,
    body: () =>
      `${heading('把尺子放松一点', '自然站立，贴合身体，不收紧软尺')}<div class="measure-guide">${img('look', '姿态参考示例，非专业测量图')}<ol><li>01 肩宽<span>两侧肩峰之间的距离。</span></li><li>02 胸围<span>胸部最丰满处水平一周。</span></li><li>03 腰围<span>自然腰线最细处水平一周。</span></li><li>04 臀围<span>臀部最丰满处水平一周。</span></li></ol></div>${note('参数帮助保存个人资料，不等于尺码建议或合身保证。照片仅作姿态示意。')}${rules(['用厘米记录尺寸，避免估计。', '暂时不方便测量，可以留空。'])}`,
    bottom: () => btn('返回填写资料', '', 10),
    note: '正式上线需替换成验证过的测量插图；此稿展示信息结构。',
  },
  {
    id: 12,
    title: '分身候选',
    group: 2,
    body: () =>
      `${heading('选择人物参考', '确认更接近自己的轮廓与姿态')}${note('以下照片仅展示候选排版，非模型生成效果。')}<div class="candidate-grid" style="margin-top:18px"><div><div class="photo-panel">${img('look', '候选一布局示例')}${pill('已选', '', 'check')}</div><div class="caption-row"><span>候选 01</span><span>人物 v03</span></div></div><div><div class="photo-panel">${img('street', '候选二布局示例')}</div><div class="caption-row"><span>候选 02</span><span>人物 v03</span></div></div></div>${rules(['确认后才会用于下一次试穿。', '都不合适时，可重新上传人物照片。'])}`,
    bottom: () => `<div class="button-row">${btn('重新上传', 'secondary', 10)}${btn('确认候选', '', 2)}</div>`,
    note: 'JD 候选确认目标状态；照片为不同示例，不表示同人一致性。',
  },
  {
    id: 13,
    title: '单品详情',
    group: 2,
    body: () =>
      `<div class="photo-panel tall">${img('shirt', '浅蓝棉质衬衫')}${pill('仅自己可见', '', 'lock-keyhole')}</div><div class="section-head"><h2>浅蓝棉质衬衫</h2><span class="text-link">编辑</span></div><p class="muted">10 月 18 日加入衣橱</p>${row('品类', '', '<span class="tag-end">上装</span>')}${row('颜色', '', '<span class="tag-end">浅蓝色</span>')}${row('风格', '', '<span class="tag-end">日常 / 通勤</span>')}${row('删除这件衣物', '历史试穿记录仍保留')}`,
    bottom: () => btn('用这件衣物试穿', '', 2),
    note: '查看、编辑、删除与试穿入口完整；不暗示商品购买。',
  },
  {
    id: 14,
    title: '添加衣物',
    group: 2,
    body: () =>
      `${heading('添加一件衣物', '正面平铺、背景简单，效果会更清楚')}<div class="photo-panel">${img('shirt', '已选中的衣物照片')}<span class="photo-edit">更换图片</span></div>${field('衣物名称', '浅蓝棉质衬衫')}${field('品类', `上装 ${icon('chevron-right')}`)}<div class="field-grid">${field('颜色', '浅蓝色')}${field('风格', '日常')}</div>${privacy('照片保存到私有衣橱，可随时删除')}`,
    bottom: () => btn('保存到衣橱', '', 15),
    note: '选图、上传、保存分别有状态，失败保留有效输入。',
  },
  {
    id: 15,
    title: '上传中',
    group: 2,
    body: () =>
      `${heading('正在上传衣物', '保留当前页面，等待图片处理完成')}<div class="upload-panel">${img('shirt', '上传中的衣物')}<div class="upload-status"><div class="line"><b>图片上传中</b><span>62%</span></div><div class="progress-track"><span></span></div></div></div>${row('浅蓝棉质衬衫', '上装 · 浅蓝色 · 日常', pill('待保存', 'warn'))}${note('上传完成后会检查图片是否可用，再保存到你的衣橱。')}`,
    bottom: () => `${btn('正在上传…', 'disabled')}<p class="fineprint">当前图片仍保留，请勿重复选择</p>`,
    note: '62% 是设计示例；实际需绑定真实上传进度。',
  },
  {
    id: 16,
    title: '上传失败',
    group: 2,
    body: () =>
      `${heading('图片还没有传完', '衣物名称和已选图片都已保留')}<div class="upload-panel">${img('shirt', '上传失败后保留的衣物图')}<div class="upload-status"><div class="line"><b>网络连接已中断</b>${icon('circle-alert')}</div></div></div>${note('连接恢复后，继续上传这张图片即可。无需重新填写。', 'error')}${row('浅蓝棉质衬衫', '上装 · 浅蓝色 · 日常', pill('待上传', 'danger'))}${privacy()}`,
    bottom: () => `<div class="button-row">${btn('稍后继续', 'secondary', 3)}${btn('重试上传', '', 15)}</div>`,
    note: '弱网重试同一上传意图，不重复创建资产。',
  },
  {
    id: 17,
    title: '确认试穿',
    group: 3,
    body: () =>
      `${heading('确认这次试穿', '检查人物与衣物，确认后再开始')}${pair()}${row('人物资料', '版本 03 · 168 cm / 53 kg', pill('当前版本'))}${row('本次使用', '成功后扣除，失败或取消会返还', '<b>1 次</b>')}${row('剩余可用', '', '<b>3 次</b>')}${privacy('结果默认私有。发布到社区需要再次确认。')}`,
    bottom: () => btn('确认并开始试穿', '', 18),
    note: '提交前审阅；两次点击或丢失响应继续同一个任务。',
  },
  {
    id: 18,
    title: '任务进行中',
    group: 3,
    body: () =>
      `${heading('正在准备你的搭配', '可以离开，稍后从试穿记录回来')}${pair()}<div class="timeline"><div class="event done"><h3>人物与衣物已接收</h3><p>人物 v03 · 浅蓝棉质衬衫</p></div><div class="event current"><h3>试穿处理中</h3><p>实际耗时取决于任务队列，请稍后查看。</p></div><div class="event"><h3>确认并保存结果</h3><p>完成后你会收到站内消息。</p></div></div>${note('已预留 1 次，取消或失败后自动返还。')}`,
    bottom: () => `<div class="button-row">${btn('取消任务', 'secondary', 23)}${btn('查看最新状态', '', 19)}</div>`,
    note: '预览按钮仅切换画板；生产状态必须来自服务端。',
  },
  {
    id: 19,
    title: '试穿结果',
    group: 3,
    body: result,
    bottom: () => `<div class="button-row">${btn('确认并云端保存', '', 20)}${btn('发布穿搭', 'secondary', 21)}</div>`,
    note: '摄影仅作效果位置示意；云端保存不等于下载到相册。',
  },
  {
    id: 20,
    title: '试穿记录',
    group: 3,
    body: () =>
      `${heading('试穿记录', '每一次尝试，都可以回来继续')}${chips(['全部', '已保存', '进行中'])}${row('浅蓝衬衫的日常', '今天 10:24 · 人物 v03', pill('待确认', 'warn'), 'look')}${row('白色 T 恤', '昨天 19:10 · 人物 v03', pill('已保存'), 'street')}${row('直筒牛仔裤', '昨天 16:30 · 人物 v02', pill('失败已返还', 'danger'), 'denim')}${row('浅蓝衬衫', '10 月 17 日 · 人物 v02', pill('已取消', 'outline'), 'shirt')}`,
    bottom: () => btn('开始新的试穿', '', 2),
    note: '列表承载历史与终态；失败可查原因，不静默发起新任务。',
  },
  {
    id: 21,
    title: '发布编辑',
    group: 3,
    body: () =>
      `<div class="publish-photos">${img('look', '发布图片示例')}${img('shirt', '第二张图片示例')}<div class="photo-add">${icon('plus')}添加图片</div></div><div class="publish-title">周末，穿得轻松一点</div><p class="publish-copy">用一件熟悉的衬衫，搭配简单的下装。没有特别的安排，也可以认真对待今天。</p><p class="inline-tags">#周末穿搭 #我的日常衣橱</p><div class="mini-divider"></div>${row('公开范围', '审核通过后可被其他人看到', '<span class="tag-end">公开</span>')}${row('包含 AI 生成内容', '由试穿结果带入，需保留标识', '<span class="toggle"></span>')}${privacy('原始人物照片和身体参数不会随帖子公开')}`,
    bottom: () => `${btn('确认公开并提交审核', '', 22)}<p class="fineprint">离开时保留当前会话草稿</p>`,
    note: '编辑、提交、审核分开；明确内容公开与原始资料私有边界。',
  },
  {
    id: 22,
    title: '发布待审核',
    group: 3,
    body: () =>
      `${state('已提交，等待审核', '审核通过后会出现在发现页。结果将通过站内消息告诉你。', 'clock')}${row('周末，穿得轻松一点', '今天 10:24 · 2 张图片', pill('待审核', 'warn'), 'look')}${rules(['当前仅你能查看这篇内容。', '审核期间可以从“我的发布”查看进度。', '无需重复提交。'])}`,
    bottom: () => `<div class="button-row">${btn('回到发现', 'secondary', 1)}${btn('查看我的发布', '', 6)}</div>`,
    note: '提交成功不等于公开成功；再次进入显示实际审核状态。',
  },
  {
    id: 23,
    title: '生成失败',
    group: 3,
    body: () =>
      `${state('这次没有生成成功', '本次预留的 1 次试穿已返还。已选人物和衣物仍然保留。', 'circle-alert', 'error')}${pair()}${note('服务暂时繁忙。你可以稍后再试，或先换一件衣物。', 'warn')}${row('当前可用试穿次数', '', '<b>3 次</b>')}`,
    bottom: () => `<div class="button-row">${btn('调整衣物', 'secondary', 2)}${btn('重新确认试穿', '', 17)}</div>`,
    note: '失败说明、额度状态、保留输入与明确重试齐全。',
  },
  {
    id: 24,
    title: '人物版本冲突',
    group: 3,
    body: () =>
      `${heading('人物资料有更新', '这次试穿准备使用的资料已不是最新版本')}${person()}<div class="conflict-grid"><div><h3>当前选择 · v02</h3><p>身高 167 cm<br>腰围 70 cm<br>10 月 12 日保存</p></div><div><h3>最新资料 · v03</h3><p>身高 168 cm<br>腰围 68 cm<br>10 月 18 日保存</p></div></div>${note('更新选择后会重新展示确认页。旧试穿记录保留原来的资料。')}${privacy()}`,
    bottom: () => `<div class="button-row">${btn('查看旧版本', 'secondary', 9)}${btn('使用最新资料', '', 17)}</div>`,
    note: '禁止无提示替换人物或覆盖旧参数；用户明确决定。',
  },
  {
    id: 25,
    title: '关注与粉丝',
    group: 4,
    body: () => `${heading('Lin 的衣橱')}${summary()}${feed()}`,
    overlay: () =>
      `<div class="sheet-scrim"><section class="sheet"><div class="sheet-handle"></div><h2>关注与粉丝</h2><div class="list-tabs"><span>我关注的 36</span><span class="active">关注我的 128</span></div>${['Mia', 'Sora', 'Nina', 'Echo', 'June'].map((name, i) => `<div class="row">${avatar()}<div><h3>${name}</h3><p>${i % 2 ? '喜欢舒适的日常穿搭' : '把喜欢的衣服多穿几次'}</p></div>${btn(i % 2 ? '互相关注' : '回关', 'compact secondary')}</div>`).join('')}<p class="fineprint">已经显示 5 位 · 向下查看更多</p></section></div>`,
    note: '名单只滚动弹层，背景位置保留；关系操作逐项同步。',
  },
  {
    id: 26,
    title: '搜索与话题',
    group: 4,
    body: () =>
      `<div class="search">${icon('search')}浅蓝衬衫<span style="margin-left:auto">取消</span></div>${chips(['穿搭', '话题', '用户'])}${sh('相关话题')}${row('# 一件衬衫的多种穿法', '128 篇穿搭', '', '', 'shirt')}${sh('穿搭结果', '最新')}${feed()}`,
    note: '拟补搜索页面；同词的内容/话题/用户有明确分类。',
  },
  {
    id: 27,
    title: '穿搭挑战',
    group: 4,
    body: () =>
      `<div class="topic-cover">${img('street', '挑战主题示例')}<div class="hero-shade"></div><div class="cover-title"><h1>把同一件衣服<br>再穿一次</h1><p>本周衣橱挑战 · 10.20 — 10.27</p></div></div><div class="topic-counter"><span>128 人参与 · 示例数据</span>${pill('进行中')}</div>${sh('这次怎么玩？')}<p class="post-copy">从衣橱里选一件熟悉的单品，搭配出新的穿法。发布你的图片，并带上本次话题。</p>${sh('大家的穿搭')}${feed()}`,
    bottom: () => btn('参与挑战 · 发布穿搭', '', 21),
    note: 'JD 拟补能力；规则、时间、参与和退出需对应服务端状态。',
  },
  {
    id: 28,
    title: '登录与授权',
    group: 4,
    body: () =>
      `<div class="login-photo">${img('street', '日常穿搭照片')}</div><div class="login-content"><h1>把自己的衣橱<br>带在身边。</h1><p>登录后保存衣物、管理人物资料，继续每一次试穿。人物照片和身体参数默认私有。</p></div>${rules(['只在你选图时访问照片。', '公开发布前，始终由你确认。'])}`,
    bottom: () =>
      `${btn('同意并使用微信登录', '', 4)}<p class="consent">${icon('check')}我已阅读《用户协议》和《隐私政策》。<br>暂不登录，也可以继续浏览公开穿搭。</p>`,
    note: '正式协议待核定；同意、拒绝与返回原任务均需平台验收。',
  },
  {
    id: 29,
    title: '隐私与账号',
    group: 4,
    body: () =>
      `${heading('你的资料，由你管理', '查看、导出，或删除你的个人数据')}${privacy()}${row('人物照片与身体参数', '仅用于你主动发起的试穿', pill('私有'), '', 'user-round')}${row('我的衣物', '在你发布前不会公开', pill('私有'), '', 'shirt')}${row('导出我的数据', '申请一份账号资料副本', '', '', 'arrow-up-right')}${row('隐私政策', '查看数据使用、保存与删除说明', '', '', 'shield-check')}${row('注销账号', '提交前可查看影响与撤回期限', '', '', 'lock-keyhole')}${row('退出登录', '结束当前设备会话')}`,
    note: '完整信任入口；高风险操作进入说明与确认页。',
  },
  {
    id: 30,
    title: '数据导出',
    group: 4,
    body: () =>
      `${heading('导出我的数据', '获取你在 Lumi 保存的账号资料')}${row('最近一次导出', '今天 10:24 创建', pill('已准备好'), '', 'shield-check')}${rules(['包含人物档案、衣橱、试穿记录和社区内容。', '数据仅本人可查看，请妥善保管。', '准备好的文件在 24 小时后过期。'])}${note('有效期至明天 10:24。过期后可重新申请。')}${row('历史申请', '10 月 18 日', pill('已过期', 'outline'))}`,
    bottom: () => btn('查看导出数据'),
    note: '准备中、完成、过期、无权限完整；设计不包含真实数据。',
  },
  {
    id: 31,
    title: '注销确认',
    group: 4,
    body: () =>
      `${heading('注销前，请确认', '申请后有 7 天时间撤回')}${note('注销完成后，人物资料、衣橱和账号内容将无法恢复。', 'warn')}${rules(['申请期间可在此页面撤回。', '处理开始后不可撤回。', '建议先导出需要保留的数据。'])}${row('账号', 'Lin 的衣橱', pill('当前账号'))}${row('预计处理', '10 月 27 日后开始', '', '', 'clock')}${privacy('提交后会显示可查询的注销申请状态')}`,
    bottom: () => `<div class="stack">${btn('确认申请注销', 'danger')}${btn('保留账号', 'ghost', 29)}</div>`,
    note: '7 天为当前配置示例；正式产品应读取服务端时间。',
  },
  {
    id: 32,
    title: '弱网与失效退路',
    group: 4,
    body: () =>
      `${heading('连接暂时中断')}${state('暂时无法读取内容', '已加载的内容仍保留。连接恢复后，点击重试即可。', 'circle-alert')}${btn('重新加载', 'secondary', 1)}<div class="mini-divider"></div>${sh('内容已删除时')}<div class="empty-region">${icon('bookmark')}<h3>这篇穿搭已不可查看</h3><p>作者可能删除了内容，或内容尚未公开。<br>你可以回到发现页看看其他搭配。</p></div>${btn('返回发现', 'secondary', 1)}`,
    note: '两种独立异常状态样例；不把失效内容误报为网络错误。',
  },
];

function phone(s, t = theme) {
  return `<div class="phone"><div class="statusbar"><span>9:41</span><span class="device-signal">5G ${icon('circle')}<span>100%</span></span></div><div class="native-nav">${s.tab ? '<span class="native-brand">lumi</span>' : `<button class="icon-btn" data-go="1" aria-label="返回首页">${icon('chevron-left')}</button><span class="native-title">${s.title}</span>`}<div class="wx-capsule">${icon('ellipsis')}<span class="divider"></span>${icon('circle')}</div></div><div class="phone-body">${s.body(t)}</div>${s.bottom ? `<div class="phone-bottom">${s.bottom()}</div>` : ''}${s.tab ? tabs(s.tab) : '<div class="phone-safe"></div>'}${s.overlay ? s.overlay() : ''}</div>`;
}
const screenCard = (s, t = theme) =>
  `<article class="screen-card theme-${t}" data-screen="${s.id}"><div class="screen-label"><h3>${String(s.id).padStart(2, '0')} / ${s.title}</h3><button data-zoom="${s.id}">放大查看 ↗</button></div>${phone(s, t)}<p class="screen-note">${s.note}</p></article>`;

const adminTitles = [
  '后台登录',
  '运营总览',
  '内容审核',
  '评论审核',
  '举报处理',
  '生成任务',
  '用户与权限',
  '隐私请求',
  '公告编辑',
  '操作审计',
];
const table = (headers, rows) =>
  `<table class="admin-table"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="admin-pagination"><span>固定设计数据 · 共 ${rows.length} 条示例</span><span>每页 20 条 ${icon('chevron-left')} 1 ${icon('chevron-right')}</span></div>`;
const filter = (label) => `<span class="filter">${label}${icon('chevron-right')}</span>`;
const toolbar = (text, options = ['全部状态', '最近 7 天']) =>
  `<div class="admin-toolbar"><div class="left"><div class="search">${icon('search')}${text}</div>${options.map(filter).join('')}</div>${btn('导出当前列表', 'compact secondary')}</div>`;
const adminMedia = (title, sub, key = 'look') =>
  `<span class="admin-cell-media">${img(key, title)}<span><b>${title}</b><span class="sub">${sub}</span></span></span>`;
const actions = (labels = ['查看', '处理']) =>
  `<span class="admin-actions">${labels.map((label) => `<a href="#" data-demo>${label}</a>`).join(' ')}</span>`;
function adminContent(id) {
  if (id === 2)
    return `<div class="admin-metrics">${[
      ['待审核内容', '24', '帖子 18 / 评论 6'],
      ['今日试穿任务', '186', '完成 172 / 进行中 8'],
      ['待处理举报', '07', '2 条需要优先处理'],
      ['隐私请求', '03', '数据导出 2 / 注销 1'],
    ]
      .map(([a, b, c]) => `<div><span>${a}</span><b>${b}</b><small>${c}</small></div>`)
      .join(
        '',
      )}</div><div class="admin-two"><section class="admin-panel"><h2>待办事项</h2>${row('18 篇帖子等待审核', '最早提交于 09:24', pill('待处理', 'warn'))}${row('2 条举报需要复核', '含隐私信息投诉', pill('优先', 'danger'))}${row('1 个任务重试失败', '查看错误原因与退款记录', pill('需关注', 'warn'))}</section><section class="admin-panel"><h2>服务状态</h2>${row('API 服务', '最近检查 10:24', pill('正常'))}${row('生成队列', '8 个任务处理中', pill('运行中'))}${row('模型接入', '本地开发适配器', pill('未上线', 'warn'))}</section></div><div class="section-head"><h2>最近审核操作</h2><span class="text-link">全部审计记录</span></div>${table(
      ['操作时间', '操作员', '对象', '结果'],
      [
        ['10:22:18', 'moderator_01', '帖子 #P1024', pill('通过')],
        ['10:20:03', 'moderator_02', '评论 #C0763', pill('拒绝', 'danger')],
      ],
    )}`;
  if (id === 3)
    return `${toolbar('搜索标题 / 内容编号', ['待审核', '全部内容'])}<div class="admin-panel"><div class="review-preview">${img('look', '待审核穿搭')}<div>${pill('待审核', 'warn')}<h2 style="margin-top:13px">周末，穿得轻松一点</h2><p>用一件熟悉的衬衫，搭配简单的下装。没有特别的安排，也可以认真对待今天。</p><p style="margin-top:13px">#周末穿搭 #我的日常衣橱</p>${row('提交者 Lin', '内容 #P1024 · 今天 10:24', pill('含 AI 标识', 'outline'))}<div class="field"><label>审核意见 <span>拒绝 / 下架时必填</span></label><div class="input">请选择原因，并补充具体说明</div></div></div></div><div class="review-detail-bottom"><span class="muted">操作会记录到审计日志；确认前请检查所有图片。</span><div class="button-row">${btn('拒绝并说明', 'compact secondary')}${btn('通过审核', 'compact')}</div></div></div>`;
  if (id === 4)
    return `${toolbar('搜索评论内容 / 原帖编号', ['待审核', '全部来源'])}${table(
      ['评论内容 / 原帖', '提交者', '状态', '提交时间', '操作'],
      [
        [
          '<b>这件衬衫的颜色很适合你</b><span class="sub">原帖 #P1024 · 周末，穿得轻松一点</span>',
          'Mia',
          pill('待审核', 'warn'),
          '10:24',
          actions(['原帖', '审核']),
        ],
        [
          '<b>请问这个版型适合通勤吗？</b><span class="sub">原帖 #P1021 · 一件衬衫的日常</span>',
          'Sora',
          pill('待审核', 'warn'),
          '10:18',
          actions(['原帖', '审核']),
        ],
        [
          '<b>分享一下我的搭配想法</b><span class="sub">原帖 #P1018</span>',
          'June',
          pill('已通过'),
          '09:57',
          actions(['查看', '下架']),
        ],
      ],
    )}<div class="admin-panel"><h2>审核说明</h2><p>待审核评论仅作者可见，不计入公开评论数。删除或下架后，原帖和消息入口应同步显示内容状态。</p></div>`;
  if (id === 5)
    return `${toolbar('搜索举报编号 / 内容', ['待处理', '全部类型'])}${table(
      ['举报对象', '原因', '状态', '举报时间', '操作'],
      [
        [
          adminMedia('帖子 #P1024', '周末，穿得轻松一点'),
          '疑似未经授权使用照片',
          pill('待复核', 'danger'),
          '10:22',
          actions(['查看证据']),
        ],
        [
          adminMedia('评论 #C0763', '原帖 #P1017', 'street'),
          '不当言论',
          pill('待处理', 'warn'),
          '09:55',
          actions(['查看证据']),
        ],
        [
          adminMedia('帖子 #P1009', '简单，也很好看', 'street'),
          '垃圾信息',
          pill('已处理'),
          '昨天',
          actions(['查看结论']),
        ],
      ],
    )}<div class="admin-panel"><h2>处理结论</h2><p>需记录证据、处理原因和内容状态变化。驳回举报或下架内容均需明确确认，不能依赖误触触发。</p></div>`;
  if (id === 6)
    return `${toolbar('搜索任务编号 / 用户', ['失败 / 死信', '全部提供方'])}${table(
      ['任务 / 输入', '提供方', '状态', '额度处理', '操作'],
      [
        [
          '<b>JOB-1024</b><span class="sub">人物 v03 / 浅蓝衬衫</span>',
          'local-svg · 开发',
          pill('已完成'),
          '扣除 1 次',
          actions(['详情']),
        ],
        [
          '<b>JOB-1023</b><span class="sub">人物 v02 / 白色 T 恤</span>',
          'local-svg · 开发',
          pill('失败', 'danger'),
          '已返还 1 次',
          actions(['错误详情', '重试']),
        ],
        [
          '<b>JOB-1022</b><span class="sub">人物 v03 / 牛仔裤</span>',
          'local-svg · 开发',
          pill('处理中', 'warn'),
          '预留 1 次',
          actions(['查询']),
        ],
      ],
    )}<div class="admin-two"><section class="admin-panel"><h2>失败原因 · JOB-1023</h2><p>提供方响应超时。自动重试已结束。</p><div class="mini-divider"></div><p>人工重试需确认用户状态、输入资源和额度，并保留原任务审计。</p></section><section class="admin-panel"><h2>任务事件</h2>${row('10:20 进入队列', '', pill('成功'))}${row('10:21 提供方超时', '', pill('失败', 'danger'))}${row('10:23 额度返还完成', '', pill('已结算'))}</section></div>`;
  if (id === 7)
    return `${toolbar('搜索用户昵称 / ID', ['全部角色', '全部状态'])}${table(
      ['用户', '角色', '账号状态', '最近活动', '操作'],
      [
        [adminMedia('Lin', 'USER-0124', 'portrait'), '用户', pill('正常'), '今天 10:24', actions(['详情', '限制'])],
        [adminMedia('Mia', 'USER-0083', 'portrait'), '用户', pill('正常'), '今天 10:18', actions(['详情', '限制'])],
        [
          '<b>moderator_01</b><span class="sub">STAFF-0002</span>',
          '审核员',
          pill('启用'),
          '今天 10:22',
          actions(['权限']),
        ],
        [
          '<b>USER-0041</b><span class="sub">受限账号</span>',
          '用户',
          pill('受限', 'danger'),
          '昨天',
          actions(['审计', '解除']),
        ],
      ],
    )}<div class="admin-panel"><h2>角色边界</h2><p>审核员仅访问内容队列。用户权限、隐私处理和系统配置由管理员操作；敏感变更需记录理由与审计。</p></div>`;
  if (id === 8)
    return `${toolbar('搜索请求编号 / 用户', ['全部请求', '待处理'])}${table(
      ['请求编号', '用户', '类型', '状态 / 时间', '操作'],
      [
        [
          '<b>EXP-0042</b>',
          'USER-0124',
          '数据导出',
          `${pill('已准备好')}<span class="sub">明天 10:24 过期</span>`,
          actions(['元信息']),
        ],
        [
          '<b>DEL-0018</b>',
          'USER-0083',
          '账号注销',
          `${pill('宽限期', 'warn')}<span class="sub">10 月 27 日后处理</span>`,
          actions(['状态']),
        ],
        [
          '<b>EXP-0041</b>',
          'USER-0041',
          '数据导出',
          `${pill('已过期', 'outline')}<span class="sub">敏感数据已失效</span>`,
          actions(['审计']),
        ],
      ],
    )}<div class="admin-two"><section class="admin-panel"><h2>注销处理轨迹</h2>${row('用户提交申请', '10 月 20 日 10:24', pill('已记录'))}${row('宽限期结束', '10 月 27 日 10:24', pill('未到期', 'warn'))}${row('账号匿名化与资源清理', '到期后执行', pill('未开始', 'outline'))}</section><section class="admin-panel"><h2>数据访问</h2><p>运营界面只展示请求状态与审计元数据，不直接展示个人身体参数、照片或完整导出内容。</p></section></div>`;
  if (id === 9)
    return `<div class="admin-two"><section class="admin-panel"><h2>编辑公告</h2>${field('公告标题', '本周衣橱挑战开始了')}${field('接收范围', '已登录的活跃用户')}<div class="field"><label>正文</label><div class="input" style="min-height:120px;align-items:start;line-height:1.9">从衣橱中选择一件熟悉的单品，尝试一种新的搭配。欢迎参加本周的穿搭挑战。</div></div>${field('跳转目标', '站内话题 / 把同一件衣服再穿一次')}<div class="button-row">${btn('保存草稿', 'secondary')}${btn('预览并确认发布')}</div></section><section class="admin-panel"><h2>消息预览</h2>${row('本周衣橱挑战开始了', '系统公告 · 刚刚', '', '', 'bell')}<p>从衣橱中选择一件熟悉的单品，尝试一种新的搭配。欢迎参加本周的穿搭挑战。</p><div class="mini-divider"></div>${note('当前是未发送草稿。正式发送前展示接收范围、人数与投递时间。')}</section></div>`;
  return `${toolbar('搜索请求 ID / 操作人', ['全部动作', '最近 7 天'])}${table(
    ['时间', '操作员', '动作 / 对象', '结果', '请求 ID'],
    [
      [
        '10:24:18',
        'moderator_01',
        '<b>通过帖子审核</b><span class="sub">POST / P1024</span>',
        pill('成功'),
        'req_8f2c…',
      ],
      ['10:22:03', 'admin_01', '<b>处理举报</b><span class="sub">REPORT / R0021</span>', pill('成功'), 'req_29a1…'],
      ['10:21:40', 'system', '<b>生成失败退款</b><span class="sub">JOB / 1023</span>', pill('已结算'), 'req_74bc…'],
      [
        '10:19:08',
        'moderator_02',
        '<b>拒绝评论</b><span class="sub">COMMENT / C0763</span>',
        pill('成功'),
        'req_91df…',
      ],
    ],
  )}<div class="admin-panel"><h2>事件详情</h2><p>操作理由：内容审核通过。状态由 PENDING 变为 APPROVED。<br>此页只展示可审计的必要元信息，敏感凭据与照片签名不进入日志。</p></div>`;
}
function adminScreen(id) {
  if (id === 1)
    return `<article class="screen-card" data-admin="1"><div class="screen-label"><h3>B01 / 后台登录</h3></div><div class="admin-frame"><div class="admin-login"><div class="admin-login-photo">${img('street', '穿搭编辑照片')}<div class="hero-shade"></div><div class="admin-login-caption"><b>lumi</b><p>让好的内容，被认真看见。</p></div></div><div class="admin-login-form"><div class="eyebrow">LUMI / OPERATIONS</div><h1>登录管理工作台</h1><p class="muted">使用你的团队账号，继续今天的工作。</p>${field('账号', 'moderator@example.com')}${field('密码', '••••••••••••')}${btn('登录工作台')}<p class="fineprint">仅授权运营人员可访问 · 操作记录将保留</p></div></div></div></article>`;
  const side = [
    '运营总览',
    '内容审核',
    '评论审核',
    '举报处理',
    '生成任务',
    '用户与权限',
    '隐私请求',
    '公告编辑',
    '操作审计',
  ];
  return `<article class="screen-card" data-admin="${id}"><div class="screen-label"><h3>B${String(id).padStart(2, '0')} / ${adminTitles[id - 1]}</h3></div><div class="admin-frame"><aside class="admin-sidebar"><div class="admin-wordmark">lumi<small>OPERATIONS</small></div><span class="admin-nav-caption">工作空间</span>${side.map((title, i) => `<div class="admin-link ${i + 2 === id ? 'selected' : ''}">${icon(['grid-2x2', 'bookmark', 'ellipsis', 'shield-check', 'clock', 'user-round', 'lock-keyhole', 'bell', 'settings-2'][i])}${title}</div>`).join('')}<div class="admin-user">${avatar()}<span>Lin · 管理员<br><small>退出登录</small></span></div></aside><div class="admin-main"><div class="admin-topbar"><span>工作空间 / ${adminTitles[id - 1]}</span><span class="right">${pill('设计示例数据', 'outline')}${icon('bell')}帮助</span></div><div class="admin-content"><div class="page-heading"><div><h1>${adminTitles[id - 1]}</h1><p class="muted">${id === 2 ? '今天的内容、任务与待办概况' : '查看状态、核对上下文，再执行操作'}</p></div>${filter('2026 年 10 月 20 日')}</div>${adminContent(id)}</div></div></div><p class="screen-note">后台目标样稿，包含尚未实现的运营能力；所有行均为固定示例数据。</p></article>`;
}
const themes = {
  a: { title: '发现优先', subtitle: '双列穿搭图片、轻导航与快速收藏。适合内容驱动的首次发现。', letter: 'A' },
  b: {
    title: '数字衣橱',
    subtitle: '借鉴 Whering 的衣橱组织与单品选择逻辑：资产清楚、步骤清楚、下一步清楚。',
    letter: 'B',
  },
  c: { title: '编辑穿搭', subtitle: '大图与低密度编排，让每一套穿搭有足够空间。适合内容质感优先的品牌。', letter: 'C' },
};
const groups = {
  core: '三套方向 · 核心比较',
  1: '01 / 浏览与个人入口',
  2: '02 / 人物、衣物与上传',
  3: '03 / 试穿、结果与发布',
  4: '04 / 关系、隐私与恢复',
  admin: '05 / 运营管理后台',
  all: '全部小程序页面',
};
function render() {
  document.body.className = `theme-${theme}${params.has('capture') ? ' capture' : ''}`;
  document.querySelectorAll('[data-theme]').forEach((a) => {
    a.classList.toggle('active', a.dataset.theme === theme);
    a.href = `?theme=${a.dataset.theme}&section=${section}`;
  });
  const one = screens.find((s) => s.id === Number(params.get('screen')));
  if (one) {
    document.getElementById('review').innerHTML = `<div class="single-wrap">${screenCard(one)}</div>`;
    return;
  }
  const spec = themes[theme];
  const selected =
    section === 'core'
      ? screens.filter((s) => [1, 2, 19].includes(s.id))
      : section === 'all'
        ? screens
        : screens.filter((s) => s.group === Number(section));
  const adminId = Number(params.get('admin'));
  document.getElementById('review').innerHTML =
    `<div class="review-wrap ${section === 'core' ? 'core' : ''}"><div class="review-intro"><div><div class="eyebrow">LUMI / WECHAT MINI PROGRAM / DESIGN REVIEW 02</div><h1>${section === 'admin' ? '运营工作台 · 全量样稿' : `${spec.letter} · ${spec.title}`}</h1><p>${section === 'admin' ? '统一导航、真实任务语义、状态与审计上下文。以下数据均为设计示例。' : spec.subtitle}<br>待审方案 · 照片为布局示意 · 选稿后再改造现有 UI</p></div><span class="direction-index">${section === 'admin' ? 'OP' : spec.letter}</span></div><nav class="section-tabs">${Object.entries(
      groups,
    )
      .map(
        ([key, label]) =>
          `<a class="${key === section ? 'active' : ''}" href="?theme=${theme}&section=${key}">${label}</a>`,
      )
      .join(
        '',
      )}</nav><div class="board-heading"><h2>${groups[section] || groups.core}</h2><p>${section === 'admin' ? '10 个运营页面' : section === 'core' ? '同任务 · 同内容 · 不同信息密度' : '点击“放大查看”审阅单页，页面内容可滚动'}</p></div>${section === 'admin' ? `<div class="admin-grid">${(adminId ? [adminId] : adminTitles.map((_, i) => i + 1)).map(adminScreen).join('')}</div>` : `<div class="screen-grid">${selected.map((s) => screenCard(s)).join('')}</div>`}<footer class="review-footer"><span>参考：Whering 衣橱组织 / Pinterest 内容发现 / Indyx 衣橱与编辑层级<br>保留 Lumi 任务：建档 → 选衣 → 审阅 → 试穿 → 确认 → 保存 / 审核发布</span><span>32 张小程序页面与状态图 · 10 张后台图<br>2026.10.20 · 设计审阅稿，非微信运行时验收</span></footer></div>`;
}
render();
const dialog = document.getElementById('screen-dialog');
document.addEventListener('click', (event) => {
  const zoom = event.target.closest('[data-zoom], [data-go]');
  if (zoom) {
    const s = screens.find((screen) => screen.id === Number(zoom.dataset.zoom || zoom.dataset.go));
    if (!s) return;
    document.getElementById('dialog-content').innerHTML = `<div class="theme-${theme}">${screenCard(s)}</div>`;
    if (!dialog.open) dialog.showModal();
    return;
  }
  if (event.target.closest('.dialog-close')) dialog.close();
  const chip = event.target.closest('[data-chip]');
  if (chip) {
    chip.parentElement.querySelectorAll('.chip').forEach((item) => item.classList.remove('active'));
    chip.classList.add('active');
  }
  if (event.target.closest('[data-demo]')) {
    event.preventDefault();
    const toast = document.getElementById('review-toast');
    toast.textContent = '设计稿操作示意：未发送请求，也未保存任何数据。';
    toast.style.display = 'block';
    clearTimeout(window.reviewToastTimer);
    window.reviewToastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 2400);
  }
});
