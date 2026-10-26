# 通知详情 ModalSheet 联调记录

## 修复范围

- 通知中心不再使用原生 `showModal` 承载公告、不可用消息和评论状态详情。
- 长文本进入统一 `ModalSheet` 的内部 `ScrollView`，打开期间锁定页面背景滚动，关闭时恢复原始位置。
- 评论状态详情保留“查看原帖”动作；关闭弹层不会误触发导航，点击动作才继续原有帖子路由。
- 可直接跳转的帖子、生成任务和关注列表通知仍按原路由导航，避免引入不必要的中间态。

## 验证

- `pnpm --filter @lumi/miniapp typecheck`
- `pnpm --filter @lumi/miniapp test`：36 项通过，包含滚动锁定和会话刷新竞态用例。
- `pnpm check`：提交前执行全 workspace 格式、Lint、类型、测试和构建。

这是小程序代码和本地测试的交付证据；微信开发者工具、iOS/Android 真机的弹层手势和弱网验收仍属于 Q08 发布门槛。
