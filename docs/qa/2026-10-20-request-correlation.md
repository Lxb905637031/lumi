# 跨端请求编号验证

NestJS 的成功/异常响应均通过 `x-request-id` 与 envelope `meta.requestId` 返回同一编号；服务端 5xx 日志包含该 ID。小程序 `ApiRequestError` 和后台 API 错误提示保留编号，纯网络故障不伪造服务端编号。

本轮补齐异步上下文：生成和公告的 BullMQ command 携带 `requestId` 与 `workflowId`，处理器日志同时输出白名单 `bullJobId`、attempt、outcome 和安全 `errorCode`。恢复扫描没有原始 HTTP 请求，统一使用 `legacy-or-recovery` 标记，不伪造请求编号。日志不写入用户正文、图片、token、异常消息或数据库输入快照；旧 Redis command 缺少新字段时回退到业务 ID，保持兼容。

验证范围：API challenge HTTP 专项逐个断言响应体/响应头 ID 相同；小程序单测覆盖带编号与无编号错误；API queue correlation 单测覆盖结构化字段、恢复标识和错误码脱敏。生产告警后端和跨进程日志采集仍未配置，因此 Q04 仍为部分完成。
