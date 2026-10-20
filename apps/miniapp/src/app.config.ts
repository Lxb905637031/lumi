export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/wardrobe/index',
    'pages/try-on/index',
    'pages/account/index',
    'pages/profiles/index',
    'pages/publish/index',
    'pages/post/index',
    'pages/posts/index',
    'pages/generations/index',
    'pages/messages/index',
    'pages/follows/index',
    'pages/privacy/index',
  ],
  tabBar: {
    color: '#687368',
    selectedColor: '#35483d',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/index/index', text: '发现' },
      { pagePath: 'pages/wardrobe/index', text: '衣橱' },
      { pagePath: 'pages/try-on/index', text: '试穿' },
      { pagePath: 'pages/account/index', text: '我的' },
    ],
  },
  window: {
    navigationBarTitleText: 'Lumi',
    navigationBarBackgroundColor: '#f7f8f4',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f7f8f4',
  },
});
