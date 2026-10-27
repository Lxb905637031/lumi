# ModalSheet 安全区布局记录

## 修复范围

- 统一弹层 footer 使用 `--lumi-safe-bottom`（`env(safe-area-inset-bottom)`）补偿底部 Home Indicator 区域。
- 没有安全区变量的运行环境使用 `0px` 回退，不改变桌面/开发工具布局。

## 验证

- `pnpm check`
- 微信开发者工具和 iOS/Android 真机仍需按 Q08 验收真实安全区、手势和长内容滚动。
