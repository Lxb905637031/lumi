# 私有图片运行手册

## 本地启动

1. 按 `.env.example` 配置开发值，`docker compose up -d seaweedfs`。此服务运行固定 tag/digest 的 SeaweedFS，禁用遥测和无关 IAM/Iceberg/Lance 服务，不暴露 filer/master/volume 端口。
2. `pnpm --filter @lumi/api storage:init-local` 创建默认私有的本地 Lumi 桶并设置显式开发 CORS，验证匿名列桶 403。脚本拒绝生产、远端地址和非 Lumi 命名桶，不修改匿名公开策略。
3. `pnpm db:deploy` 应用增量媒体状态/清理表；设置 `MEDIA_STORAGE_DRIVER=s3` 后启动 API。客户端从 bootstrap 获得 signed-post 能力，不能自己决定用开发接口。
4. 运行主业务 HTTP 回归和 `test:storage`；验收包括匿名 GET 403，签名上传/读取、过期/越权、完整解码和实际对象清理。

原 MinIO 镜像在本环境无法取得，改用 S3 协议的免费组件；旧卷 `lumi-minio` 保留。迁移旧桶数据不是本次启动的自动动作。

## 删除与故障恢复

- 删除接口在事务中标记资产不可访问，并写入 `object_cleanup`；多实例可幂等重试。对象存储故障时返回逻辑删除成功不代表字节已消失，应查询未完成任务。
- worker 每 30 秒取最多 50 条到期任务。失败保留 `attempts/last_error_code/not_before` 并退避，记录不包含用户照片或签名 URL。停机后从数据库恢复，不依赖进程内队列。
- staging 保留至原签名租约过期之后再清理；不要为了立刻清空而绕过租约，否则旧签名仍可重传产生孤儿。
- 活跃 READY 对象及有效处理租约受保护，人工排障前确认资产引用，禁止批量清桶。失败任务不得直接删表“消警”。
- PROCESSING 租约 120 秒；过期可重新 complete；超时旧 worker 不能提交 READY。上传租约过期后需要重新预留，不允许自动延长旧凭据。

## 生产发布前必须完成

生产要求 driver=s3 和 HTTPS endpoint，禁止 local/FREE_MODE。桶必须保持非匿名，应用账号只授予业务桶内必要对象读取、写入、删除；不使用 compose 管理员账号。网关之外的存储端口仅内网访问。部署专用桶/凭据并审查策略是显式运维动作，不由 API 启动自动创建。

还需 HTTPS/微信上传下载域名、存储容量监控、加密与备份恢复、独立访问审计、保留期限、平台内容审核和节点故障演练。单节点本地运行不等于这些门槛完成；临时签名 URL 在最长 60 秒内可能仍有效，不能承诺即时撤销。
