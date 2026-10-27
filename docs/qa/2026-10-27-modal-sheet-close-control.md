# ModalSheet 关闭控件语义记录

## 修复范围

- 关闭控件由可点击文本改为 Taro `Button`，保留原有 `×` 视觉并补充 `aria-label="关闭"`。
- 清除小程序 Button 默认边框，避免主题样式走形。
- 遮罩点击、关闭按钮和组件卸载仍共用原有 `onClose` 入口。

## 验证

- `pnpm check`
- 微信开发者工具和 iOS/Android 真机仍需按 Q08 验收焦点、触摸区域和辅助功能表现。
