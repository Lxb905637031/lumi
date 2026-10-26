# 账号导出结果 ModalSheet 联调记录

## 修复范围

- 账号隐私页的数据导出结果不再使用原生 `showModal`，改为统一 `ModalSheet`。
- 导出结果文案可在内部滚动区域完整阅读，关闭弹层只清理当前提示，不重复发起下载。
- 注销账号、删除结果等高风险确认继续使用原生确认框，避免弱化确认和误操作语义。

## 验证

- `pnpm --filter @lumi/miniapp typecheck`
- `pnpm --filter @lumi/miniapp test`
- `pnpm check`

微信开发者工具、iOS/Android 真机的弹层手势和安全区仍属于 Q08 发布门槛。
