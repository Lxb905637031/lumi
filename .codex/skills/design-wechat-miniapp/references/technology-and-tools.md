# 技术与工具选择

## 技术栈决策

| 条件 | 默认选择 | 主要取舍 |
|---|---|---|
| 已有项目 | 保持现有栈 | 避免平行组件系统和迁移风险 |
| 仅做微信，深度使用原生能力或性能敏感 | 原生 WXML/WXSS/TypeScript | 平台还原直接；浏览器迭代较弱 |
| React 团队，需要 H5 快速预览或未来多端 | Taro + React + TypeScript | 视觉迭代快；微信特有能力仍需端内验证 |
| Vue/HBuilderX 团队或明确需要 uni-app 生态 | uni-app + Vue + TypeScript | Vue 生态友好；平台差异需显式处理 |
| 只验证产品体验 | 移动端交互原型 | 速度快；不得宣称等同微信运行时 |

不要为了使用某个 UI Skill 改写用户已有技术栈。选定一套尺寸与单位策略并保持一致，不要在同一组件里随意混用设计像素、`rpx` 和运行时像素。

## 验证层级

1. **视觉目标**：用高保真稿决定方向。
2. **H5/浏览器**：快速检查层级、布局、主流程和截图差异。
3. **微信开发者工具**：检查小程序构建、页面栈、组件和平台 API。
4. **真机**：检查字体、键盘、安全区、权限、支付、性能和 iOS/Android 差异。

只有第 3、4 层可以为小程序运行时结论背书。

## 分享者流程的映射

| Web UI 工具角色 | 本 Skill 的执行方式 |
|---|---|
| frontend-design | Product Design ideate + ImageGen，固定三套可见方向 |
| UI-UX-Pro-Max | Product Design 负责 UX；UI Craft 负责具体视觉规范 |
| Open Design / Stitch | Open Design 按需使用；用 `DESIGN.md`、Tokens 和组件状态固化结果 |
| shadcn / Radix | 替换为项目现有小程序组件、Taro 组件或原生组件 |
| Hallmark / Impeccable | 先 Product Design audit/design QA，再用 UI Craft 精修 |
| Web-Design-Guidelines | 保留通用可访问性，增加开发者工具与双端真机质量门 |

保留“分阶段、单一职责、开发后审查与精修分开”的思想，不强制安装全部第三方工具。

## 自动化建议

项目已经有相应依赖时，可建立以下命令；不要为纯设计任务强制安装：

- H5 开发与截图回归；
- 微信小程序 watch 构建；
- 微信开发者工具自动打开；
- `miniprogram-automator` 核心流截图；
- `miniprogram-ci` 预览或上传。

视觉基线应固定工具版本、模拟设备、字体、测试数据和等待条件。最终发布门仍是真机核心流程。

