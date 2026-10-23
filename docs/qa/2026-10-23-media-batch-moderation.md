# B04 素材批量审核验收

## 范围

- 管理后台图片审核队列支持选择当前页未审核素材，批量通过或拒绝。
- `PATCH /api/v1/admin/moderation/media/batch/status` 最多处理 50 条，每条输入携带 `id` 和 `expectedUpdatedAt`；拒绝重复 ID、无效状态和空数组。
- 同一数据库事务内按 ID 顺序锁定所有素材；任意素材不存在、已删除、版本过期或处理状态不可审核时整批回滚。
- 每条实际状态变更写素材审核审计；拒绝同步设置私有可见性，后续生成仍阻断。
- 已处于目标状态的记录幂等跳过并计入 `skippedCount`，不会重复写审计。

## 验收命令

```sh
LUMI_API_URL=http://127.0.0.1:14330/api/v1 pnpm --filter @lumi/api test:media-moderation
```

## 验收结果

已通过 24 次真实 loopback HTTP/PostgreSQL 请求，覆盖审核角色 RBAC、重复 ID DTO 校验、批量成功、时间戳过期混合状态整批回滚、幂等重试、审核历史、队列筛选和拒绝素材阻断生成。

测试只创建带唯一 runId 的本地临时账号/素材并在 `finally` 清理，不访问外部服务。该证据不代表生产内容安全服务、微信后台页面或真机验收。

## 未覆盖

- 内容安全 adapter、批量并发压测和生产值守。
- 真实 S3/微信域名与微信开发者工具、iOS/Android 真机验收。
