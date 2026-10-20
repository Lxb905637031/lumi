# 跨端请求编号验证

NestJS 的成功/异常响应均通过 `x-request-id` 与 envelope `meta.requestId` 返回同一编号；服务端 5xx 日志包含该 ID。小程序 `ApiRequestError` 和后台 API 错误提示保留编号，纯网络故障不伪造服务端编号。

验证范围：API challenge HTTP 专项逐个断言响应体/响应头 ID 相同；小程序单测覆盖带编号与无编号错误。当前尚未把 ID 传播到 BullMQ 异步任务、worker 日志与告警系统，因此 Q04 保持部分完成。
