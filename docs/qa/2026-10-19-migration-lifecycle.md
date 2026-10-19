# 2026-10-19 数据迁移阶段验证

## 实际执行

- `DATABASE_URL=<local PostgreSQL> pnpm test:migrations` 通过：2 个随机隔离 schema，空库部署、重复部署与当前结构一致；旧版完整基线插入用户/档案哨兵，添加测试漂移后拒绝纳管且不生成迁移历史，移除测试漂移后纳管/部署成功且哨兵保留。
- 默认远端数据库拒绝；未确认备份的远端显式开关仍拒绝。
- `pnpm check` 通过：格式、Lint、类型检查、12 项 API 单测、Nest/Vite/Taro weapp 构建。
- 本地既有数据库通过 `pg_dump --format=custom` 备份，`pg_restore --list` 验证备份可读（不是完整恢复演练）；备份留在被 Git 忽略的 `output/database/`，不上传仓库。
- 本地既有 public 结构严格匹配不可变基线后执行 `db:adopt-baseline` 成功，只新增迁移历史，不重建业务表或删除记录。
- CI 从 `db:push` 改为 `db:deploy`，加入隔离迁移回归；远端 CI 结果未据此自动认定通过。

## 边界

本阶段关闭的是代码与本地数据库迁移门槛 R01，不是生产发布。生产备份恢复演练、大数据量下锁等待、真实部署权限和后续增量变更仍需持续验收。对象存储、真实 AI、微信真机等未完成事项不变。

开发测试 schema 已在 finally 中清理，仅删除本次随机生成的数据；原有 public 及数据保留。
