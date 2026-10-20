# 2026-10-20 设计评审板 QA 记录

## 范围

仅验证 `docs/design/` 的静态评审板和导出截图。未验证 Taro 页面、NestJS API、微信开发者工具、真机或真实模型服务。

## 检查结果

| 检查                 | 结果 | 证据                                                                                |
| -------------------- | ---- | ----------------------------------------------------------------------------------- |
| JavaScript 语法      | 通过 | `node --check docs/design/lumi-ui-review.js`                                        |
| 评审板 ESLint        | 通过 | `eslint docs/design/lumi-ui-review.js`                                              |
| HTML/CSS/JS Prettier | 通过 | `prettier --ignore-path /dev/null --check ...`                                      |
| 32 张小程序截图      | 通过 | `output/playwright/lumi-v2-screen-01.png` 至 `32.png` 均生成；浏览器图片错误为 0    |
| 10 张后台截图        | 通过 | `lumi-v2-admin-01.png` 至 `10.png` 均生成；浏览器图片错误为 0                       |
| 四张 B 方向分组板    | 通过 | entry/assets/workflow/trust 四张 PNG；页面与手机内部无横向溢出                      |
| A/B/C 核心比较       | 通过 | 三张 core PNG；同一任务在三种信息密度下可对比                                       |
| 390px 窄屏           | 通过 | `document.documentElement.scrollWidth === innerWidth`，小程序和后台单页均无横向溢出 |
| 放大预览与关闭       | 通过 | 点击“放大查看”打开 `<dialog>`，Escape 可关闭                                        |
| 评审板请求边界       | 通过 | `data-demo` 操作只显示设计示意 toast；没有生产 API import 或写请求                  |

## 已知限制

- 评审板会加载 Unsplash 公开图片；离线时图片可能失败，生产必须使用自己的媒体域名、缓存和失败占位。
- 评审板数据、筛选、表单和进度均是固定示例；按钮不是可交付业务能力。
- 手机画板内部可滚动，单张 PNG 是首屏/固定视口，不覆盖所有滚动位置。
- 设计稿中的人物和结果图仅为布局示意，不能证明 AI 试穿模型质量。
- 还没有用户选择 A/B/C，因此尚未修改生产小程序 UI；这是刻意保留的设计门槛。
