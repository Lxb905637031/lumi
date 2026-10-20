// Deterministic presentation fixtures only. No network or real credentials.
const mode = new URLSearchParams(location.search).get('state') || 'ready';
export const getSessionEpoch = () => 0;
export const hasSession = () => mode !== 'anonymous';
export const clearSession = () => undefined;
export const saveAccessToken = () => undefined;
export const saveRefreshToken = () => undefined;
const photo = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&q=80`;
const media = {
  shirt: photo('photo-1596755094514-f87e34085b2c'),
  denim: photo('photo-1542272604-787c3835535d'),
  tee: photo('photo-1521572163474-6864f9cf17ab'),
  person: photo('photo-1539109136881-3be0616acf4b'),
};
const now = '2026-10-20T02:24:00.000Z';
const clothes = ['shirt', 'denim', 'tee'].map((key, i) => ({
  id: key,
  assetId: key,
  name:
    mode === 'long'
      ? '一件名称很长的衣物，用于检查窄屏换行与按钮是否变形'
      : ['浅蓝棉质衬衫', '直筒牛仔裤', '白色 T 恤'][i],
  category: i === 1 ? 'BOTTOM' : 'TOP',
  color: '浅色',
  style: '日常',
  createdAt: now,
}));
const version = {
  id: 'v3',
  version: 3,
  sourceAssetId: 'person',
  measurements: { heightCm: 168, weightKg: 53 },
  createdAt: now,
};
const post = {
  id: 'sample',
  title: mode === 'long' ? '试着用熟悉的基础款穿出一点不同的感觉这是长标题换行检查' : '周末，穿得轻松一点',
  body: '用一件熟悉的衬衫，搭配简单的下装。',
  authorName: 'Lin · 设计样例',
  authorId: 'lin',
  imagePreviews: [media.person],
  likeCount: 128,
  isAiGenerated: false,
  moderationStatus: 'APPROVED',
};
const job = {
  id: 'sample',
  status: 'SUCCEEDED',
  provider: 'local-svg',
  createdAt: now,
  outputs: [{ id: 'result', assetId: 'person', selectedAt: null, savedAt: null }],
};
const page = (items) => ({ items: mode === 'empty' ? [] : items, nextCursor: null });
export async function request(path, options = {}) {
  await new Promise((resolve) => setTimeout(resolve, 80));
  if (mode === 'error') throw new Error('连接暂时中断，请重试。此为组件错误状态样例。');
  if (options.method && options.method !== 'GET') throw new Error('这是只读组件预览，写操作请在微信环境验收。');
  const route = path.split('?')[0];
  if (route.startsWith('/media/assets/')) return { url: media[route.split('/').pop()] };
  if (route === '/wardrobe/items') return page(clothes);
  if (route === '/body-profiles')
    return page([{ id: 'profile', name: '我的人物档案', activeVersion: 3, versions: [version] }]);
  if (route.includes('quota')) return { available: 3, reserved: 0, consumed: 1, costPerGeneration: 1 };
  if (route === '/generation-jobs') return page([job]);
  if (route.startsWith('/generation-jobs/')) return job;
  if (route.endsWith('/state')) return { liked: false, bookmarked: false };
  if (route.endsWith('/follow-state')) return { following: false };
  if (route.endsWith('/following') || route.endsWith('/followers'))
    return page([{ id: 'mia', displayName: 'Mia · 设计样例', followed: false }]);
  if (route.endsWith('/comments'))
    return page([{ id: 'comment', authorName: 'Mia', body: '这件单品很适合日常搭配。' }]);
  if (route === '/community/posts/sample') return post;
  if (route.startsWith('/community/'))
    return page([post, { ...post, id: 'other', title: '把基础款再穿一次', imagePreviews: [media.shirt] }]);
  if (route === '/notifications')
    return page([
      { id: 'notice', title: '你的试穿结果已准备好', body: '可以回来确认并保存结果。', createdAt: now, readAt: null },
    ]);
  if (route === '/account/privacy/deletion') return null;
  if (route === '/account/privacy/exports') return page([]);
  throw new Error(`尚未配置预览 fixture: ${route}`);
}
