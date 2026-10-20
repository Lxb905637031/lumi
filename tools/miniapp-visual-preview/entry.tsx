import React from 'react';
import { createRoot } from 'react-dom/client';
import Index from '../../apps/miniapp/src/pages/index/index';
import Wardrobe from '../../apps/miniapp/src/pages/wardrobe/index';
import TryOn from '../../apps/miniapp/src/pages/try-on/index';
import Account from '../../apps/miniapp/src/pages/account/index';
import Profiles from '../../apps/miniapp/src/pages/profiles/index';
import Publish from '../../apps/miniapp/src/pages/publish/index';
import Post from '../../apps/miniapp/src/pages/post/index';
import Posts from '../../apps/miniapp/src/pages/posts/index';
import Generations from '../../apps/miniapp/src/pages/generations/index';
import Messages from '../../apps/miniapp/src/pages/messages/index';
import Follows from '../../apps/miniapp/src/pages/follows/index';
import Privacy from '../../apps/miniapp/src/pages/privacy/index';
import { BottomNavigation } from '../../apps/miniapp/src/features/home/components/BottomNavigation';
import Taro from './taro';

const routes = {
  index: Index,
  wardrobe: Wardrobe,
  'try-on': TryOn,
  account: Account,
  profiles: Profiles,
  publish: Publish,
  post: Post,
  posts: Posts,
  generations: Generations,
  messages: Messages,
  follows: Follows,
  privacy: Privacy,
};
const tabs = { index: '发现', wardrobe: '衣橱', 'try-on': '试穿', account: '我的' };
const route = new URLSearchParams(location.search).get('page') || 'index';
const Page = routes[route] || Index;
createRoot(document.getElementById('root')).render(
  <>
    <aside className="preview-label">实际组件 · 固定样例 · 非微信运行时</aside>
    <main>
      <Page />
    </main>
    {tabs[route] && (
      <BottomNavigation
        activeTab={tabs[route]}
        onChange={(label) =>
          Taro.switchTab({ url: `/pages/${Object.keys(tabs).find((key) => tabs[key] === label)}/index` })
        }
      />
    )}
  </>,
);
