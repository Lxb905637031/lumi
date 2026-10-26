# 试穿分享开发预览说明 ModalSheet 联调记录

## 修复范围

- 分享页的开发预览说明不再使用原生 `showModal`，改为统一 `ModalSheet`。
- 说明文本在内部滚动区域展示，关闭提示不会触发下载或分享动作。
- 相册权限授权和开发预览下载拦截仍保持明确分支；高风险权限确认继续使用原生确认框。

## 验证

- `pnpm --filter @lumi/miniapp typecheck`
- `pnpm --filter @lumi/miniapp test`
- `pnpm check`

这是本地开发预览链路的交互修复，不代表真实模型、合法域名或微信真机相册验收完成。
