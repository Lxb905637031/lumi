# Lumi 项目技能清单

这些技能从公开 GitHub 仓库安装到项目内，用于让后续开发、测试和产品拆解有可追溯的规则来源。

| Skill | 来源 | 用途 |
| --- | --- | --- |
| `design-wechat-miniapp` | https://github.com/xypasolini-droid/design-wechat-miniapp-skill/tree/main/skill/design-wechat-miniapp | 微信小程序/Taro 的产品流程、视觉规范、状态矩阵、真机质量闸门 |
| `nutui-react-taro` | https://github.com/jsfsds/nutui-react-taro-skill/tree/main/nutui-react-taro | React Taro 组件选择、版本核对和小程序交互实现 |
| `playwright` | https://github.com/openai/skills/tree/main/skills/.curated/playwright | 管理后台/H5 的浏览器自动化、截图和流程回归 |
| `notion-spec-to-implementation` | https://github.com/openai/skills/tree/main/skills/.curated/notion-spec-to-implementation | 需求解析、阶段计划、任务和验收跟踪；本项目用本地 Markdown 作为规格来源 |

## 选型记录

- GitHub 搜索结果中 `roriawu-ux/taro` 的默认分支当前没有可安装的 `SKILL.md` 文件，因此没有把它作为项目 skill 安装。
- `nutui-react-taro` 只在真实需要交互组件时引入依赖。当前首屏以 Taro 原语为主，避免无必要的包体和版本风险。
- 项目内副本保留上游许可证和 reference，更新 skill 时需要记录来源 commit 或日期。
