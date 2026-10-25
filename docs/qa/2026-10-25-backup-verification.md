# 本地备份可读性校验

## 交付边界

- `scripts/backup-local.mjs` 创建 custom-format dump 后会调用独立校验脚本；`pg_restore --list` 失败时命令失败并保留不了不可信的 dump。
- `scripts/verify-backup-local.mjs` 支持对已有 dump 重复校验，并输出字节数和 SHA-256，便于把校验值写入发布记录。
- 本机没有安装 PostgreSQL 客户端时，校验会尝试通过开发容器 `lumi-postgres-1` 读取 dump；容器不可用则明确失败，不降级为仅检查文件大小。
- 仅允许非生产环境，`output/` 下的 dump 和校验文件不纳入 Git。

## 验收方式

```bash
DATABASE_URL=postgresql://... pnpm backup:local -- output/backups/check.dump
pnpm backup:verify -- output/backups/check.dump
```

恢复仍需在隔离数据库执行，并在恢复后运行 `pnpm db:deploy`、健康检查和关键 HTTP 烟测。该证据不代表已配置生产备份服务、异地媒体副本、保留作业或完成灾备演练。
