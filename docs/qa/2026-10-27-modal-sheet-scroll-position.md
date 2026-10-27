# ModalSheet 打开时滚动位置回归

## 缺陷

ModalSheet 的滚动锁控制器在组件首次渲染时捕获 `window.scrollY`，而业务弹层长期挂载且默认关闭。用户之后滚动页面再打开弹层时，原实现仍按首次渲染的旧位置锁定和恢复，可能造成关闭后页面跳动。

## 修复与验证

- 改为每次打开时通过 getter 捕获最新页面位置，关闭时恢复同一位置。
- 新增控制器创建后滚动、再锁定并恢复的回归测试。
- `pnpm --filter @lumi/miniapp typecheck`
- `pnpm --filter @lumi/miniapp test`
- `pnpm check`

自动化验证不替代微信开发者工具和 iOS/Android 真机的滚动手势验收。
