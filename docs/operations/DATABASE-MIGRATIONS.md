# 数据库变更与无损纳管

数据库升级是显式发布步骤，不在 NestJS 启动时执行。`prisma/migrations` 的已应用 SQL 和 `prisma/baseline/schema.prisma` 不允许修改；新增变更用新的迁移目录。

## 全新数据库

配置部署环境的 `DATABASE_URL`，执行 `pnpm db:generate`、`pnpm db:deploy`，成功后启动 API。生产禁止使用 `db push`、`migrate reset` 或 `--accept-data-loss`。

## 既有 db-push 数据库

1. 停止业务写入，备份数据库并验证可恢复。先在备份恢复出的隔离库演练。
2. 使用 `pnpm db:adopt-baseline`。脚本只在实际结构与 `ea5048e` 的不可变基线完全一致时，标记 `20261019090000_baseline` 已应用；不重新建表，不修改业务记录。
3. 如果提示 drift，停止升级，审查只读 `prisma migrate diff` 结果；禁止为了通过脚本而删除业务表/列。无法匹配的旧版本需要单独审查数据迁移。
4. 执行 `pnpm db:deploy` 应用后续增量迁移，执行健康与关键业务回归，再恢复写入。

默认拒绝非 loopback 数据库；真实远端纳管必须由操作者确认已验证备份，设置 `LUMI_BASELINE_BACKUP_CONFIRMED=true` 并使用 `pnpm --filter @lumi/api db:adopt-baseline --allow-remote-baseline`。这些开关不是备份或审核的替代品。现有失败、回滚或未知迁移历史会拒绝纳管，不能通过反复 resolve 绕过。

重复纳管会校验基线 checksum 并返回已纳管；之后的版本由 `migrate deploy` 负责。生产恢复策略优先向前修复；不要把应用代码回滚等同于数据库回滚，删除列/收紧约束需要 expand/contract 和专项备份方案。

## 自动化验收

`pnpm test:migrations` 仅接受本机 PostgreSQL，创建随机 `lumi_migration_test_<uuid>` schema，验证：空库部署、重复部署、结构一致、旧库有数据升级、漂移拒绝且不写历史、哨兵数据保留、远端操作保护。最终只清理本次随机测试 schema，不触碰 public 或既有数据。

该测试不能代替生产备份恢复、数据量下迁移耗时/锁等待和实际部署权限验收。
