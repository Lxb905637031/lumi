# 发布与回滚基线

这份手册是可执行的开发/预发布基线，不代表 Lumi 已部署或通过生产验收。生产执行必须由具备数据库、对象存储和微信平台权限的值守人员完成。

## 发布门槛

1. 固定提交 SHA，检查 `git diff --exit-code`、依赖锁文件和迁移目录。
2. 用独立数据库执行 `pnpm db:deploy`，再执行 `pnpm check`、API 真实 HTTP 回归和小程序 Taro 构建。
3. 验证 `/api/v1/health` 和 `/api/v1/health/metrics`，确认 `FREE_MODE=false`、`MEDIA_STORAGE_DRIVER=s3`、HTTPS、CORS 白名单和密钥来自受管注入。
4. 发布前创建数据库备份并记录备份校验值；对象存储必须完成版本化/保留策略检查。
5. 小流量灰度只允许已备案的微信上传/下载域名和回滚开关，不允许用本地预览或 local-svg 作为真实 AI 结果。

## 回滚顺序

1. 停止流量并关闭生成/公告写入开关，保留查询和审核能力。
2. 回滚应用到上一个已验证 SHA。数据库迁移只执行向前兼容的修复迁移，不直接删除列或手工改表。
3. 如果数据恢复是必要的，先隔离当前数据库，使用经过校验的备份恢复到新实例，再运行 `pnpm db:deploy` 和全量 HTTP 烟测。
4. 检查队列、额度账本、对象清理任务和通知是否存在积压；恢复流量前记录负责人、时间、SHA、迁移状态和未完成任务。

## 本地演练

`node scripts/backup-local.mjs output/backups/check.dump` 可创建本地 PostgreSQL custom dump；恢复前必须显式设置 `LUMI_ALLOW_DESTRUCTIVE_RESTORE=YES` 并传入明确文件路径。脚本拒绝生产环境，但不能替代生产备份服务、异地副本或恢复演练。
