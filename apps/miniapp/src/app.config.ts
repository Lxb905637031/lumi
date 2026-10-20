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
    color: '#74676c',
    selectedColor: '#763b50',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '发现',
        iconPath: 'assets/icons/house-default.png',
        selectedIconPath: 'assets/icons/house-active.png',
      },
      {
        pagePath: 'pages/wardrobe/index',
        text: '衣橱',
        iconPath: 'assets/icons/shirt-default.png',
        selectedIconPath: 'assets/icons/shirt-active.png',
      },
      {
        pagePath: 'pages/try-on/index',
        text: '试穿',
        iconPath: 'assets/icons/grid-2x2-default.png',
        selectedIconPath: 'assets/icons/grid-2x2-active.png',
      },
      {
        pagePath: 'pages/account/index',
        text: '我的',
        iconPath: 'assets/icons/user-round-default.png',
        selectedIconPath: 'assets/icons/user-round-active.png',
      },
    ],
  },
  window: {
    navigationBarTitleText: 'Lumi',
    navigationBarBackgroundColor: '#fdfbf9',
    navigationBarTextStyle: 'black',
    backgroundColor: '#fdfbf9',
  },
});
