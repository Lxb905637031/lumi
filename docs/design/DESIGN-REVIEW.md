# Lumi V2 全量设计评审稿

日期：2026-10-20  
状态：待产品确认，尚未改造生产小程序或后台

## 评审入口

启动静态预览后打开：

`http://127.0.0.1:4318/lumi-ui-review.html?theme=b&section=core&rev=4`

预览源文件：[lumi-ui-review.html](./lumi-ui-review.html)、[lumi-ui-review.css](./lumi-ui-review.css)、[lumi-ui-review.js](./lumi-ui-review.js)。这是独立的设计评审板，不导入生产组件、不调用 Lumi API；页面上的按钮只演示导航、弹窗和状态提示。

## 需要确认的选择

| 方向                     | 重点                                       | 适用判断                             |
| ------------------------ | ------------------------------------------ | ------------------------------------ |
| A · 发现流               | 双列图片流、快速收藏、内容发现             | 内容社区增长优先                     |
| **B · 数字衣橱（候选）** | 衣物资产、人物版本、试穿上下文和明确下一步 | Lumi 的核心闭环和 Whering 参考最匹配 |
| C · 编辑穿搭             | 大图、低密度、编辑感                       | 品牌内容质感优先                     |

评审时只需要确认：选择 A/B/C 作为生产 UI 基线，以及是否保留“衣橱”作为稳定底部导航入口。确认前不把任何一套稿件视为最终视觉规范。B 的首页现已补齐“有公开内容 / 公开内容为空”两种状态，单页入口可切换审阅：`...?theme=b&screen=1&state=content&rev=4` 与 `...?theme=b&screen=1&state=empty&rev=4`。

## 小程序画板

共 32 张页面与关键状态图，按用户任务分组。每张可通过 `screen=编号` 单独打开，例如：`...?theme=b&screen=19&rev=3`。

| 组            | 页面                                                                                                   | 画板入口                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 01 浏览与入口 | 01 发现（正常内容 / 空 Feed）、02 试穿、03 衣橱、04 我的、05 帖子详情、06 我的发布、07 收藏、08 消息 | [分组预览](./lumi-ui-review.html?theme=b&section=1&rev=4) · [PNG](./output/playwright/lumi-v2-b-01-entry.png) · [空态 PNG](./output/playwright/lumi-v2-screen-01-empty-mobile.png) |
| 02 私有资产   | 09 身材档案、10 编辑档案、11 测量指引、12 分身候选、13 单品详情、14 添加衣物、15 上传中、16 上传失败   | [分组预览](./lumi-ui-review.html?theme=b&section=2&rev=3) · [PNG](./output/playwright/lumi-v2-b-02-assets.png)   |
| 03 核心闭环   | 17 提交确认、18 任务进行中、19 结果确认、20 生成记录、21 发布编辑、22 待审核、23 生成失败、24 参数冲突 | [分组预览](./lumi-ui-review.html?theme=b&section=3&rev=3) · [PNG](./output/playwright/lumi-v2-b-03-workflow.png) |
| 04 关系与信任 | 25 关注名单、26 搜索与话题、27 挑战、28 登录说明、29 隐私、30 数据导出、31 注销、32 弱网/内容失效      | [分组预览](./lumi-ui-review.html?theme=b&section=4&rev=3) · [PNG](./output/playwright/lumi-v2-b-04-trust.png)    |

单张 PNG：`output/playwright/lumi-v2-screen-01.png` 至 `lumi-v2-screen-32.png`。三套核心对比：[A](./output/playwright/lumi-v2-a-core.png) · [B](./output/playwright/lumi-v2-b-core.png) · [C](./output/playwright/lumi-v2-c-core.png)。

## 后台画板

共 10 张：登录、运营总览、内容审核、评论审核、举报处理、生成任务、用户与权限、隐私请求、公告编辑、操作审计。入口：[后台全量预览](./lumi-ui-review.html?theme=b&section=admin&rev=3)，单张 PNG 为 `output/playwright/lumi-v2-admin-01.png` 至 `lumi-v2-admin-10.png`。

## 设计边界

- 参考原则来自 Whering 的数字衣橱组织、Pinterest 的内容发现、Indyx 的衣橱/编辑层级；不复制品牌字标、摄影、配色或专有组件。
- Unsplash 图片只是布局素材；人物与试穿结果明确标注为“效果示意”，不代表真实模型能力。
- 示例数据固定写在评审板中；真实图片、额度、任务、审核、消息和隐私请求仍需接入服务端。
- 32 个小程序页面加 1 个发现页空态变体，覆盖关键页面和状态，不等于所有状态组合。生产实现仍需补齐 loading、empty、error、permission denied、submitting、success、stale response 和微信真机验收。
- 发现页空态不再使用孤立提示框：必须说明公开内容为空的原因，并提供“查看我的衣橱”和“开始一次试穿”两个业务下一步；这是设计要求，不代表接口已经提供真实推荐数据。

## 评审后的实施顺序

1. 固化选定方向的 tokens、页面信息架构和组件拆分。
2. 按“衣橱/档案 → 试穿/结果 → 发布/审核 → 消息/隐私”逐域改造 Taro 页面并接入现有 API。
3. 用 API 合约测试、Taro 构建、微信开发者工具和至少一台真机完成验收；设计截图不能替代运行时验收。
