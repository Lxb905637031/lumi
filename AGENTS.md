# Lumi 项目开发规范

本仓库按项目内 `.codex/skills/` 的技能说明开发。开始新功能前先读取相关技能的 `SKILL.md` 和需要的 reference 文件。

## 技能使用范围

- `design-wechat-miniapp`：所有 Taro/微信小程序页面、交互、状态矩阵、真机验收和 UI 审查。
- `nutui-react-taro`：只有页面需要 NutUI 组件时使用；先检查当前 Taro/NutUI 版本和类型，再决定是否引入组件。
- `playwright`：管理后台或 H5 预览的真实浏览器流程、截图和回归检查；浏览器结果不能替代微信开发者工具或真机验收。
- `notion-spec-to-implementation`：把产品需求拆成实现阶段、任务和验收条件。当前项目的本地 Markdown 需求文档是事实来源。

## Lumi 约束

- 目标运行时是微信小程序 `weapp`，页面使用 Taro 原语，不使用 DOM、`window`、`document` 或浏览器存储 API。
- 小程序页面必须覆盖加载、空态、错误、权限拒绝、弱网、提交中、成功和再次进入状态。
- 页面实现前更新 `docs/design/` 下的 Brief、信息架构和 UX 状态矩阵；不要在没有设计事实来源时继续扩展页面。
- 所有服务端输入使用 DTO 和 `ValidationPipe`；列表接口必须分页；生成和额度操作必须幂等。
- 业务模块按 NestJS feature module 拆分，第三方存储、模型和审核能力通过 adapter/provider 接口接入。
- 每个阶段完成后运行最窄的 typecheck/build/test，并提交一个可回滚的 Git commit。
