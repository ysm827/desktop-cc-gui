## Context

上一轮修复已经清掉了 turn boundary、requestUserInputSubmitted 和 tool fallback 的主路径残留。剩余债务主要是两类：

1. `MessagesRows.tsx` 中 generated image 与 agent badge 的组件级 fallback copy；
2. `useThreadMessaging.ts` 中写入 pending notice 的 Claude MCP 路由提示。

这些文案都是真实用户可见 surface，但分布在“组件 fallback”和“hook 侧 notice 拼接”两条链路里，所以继续沿用“同一可见语义一个 i18n key”的收口方式即可，不需要引入新的架构层。

## Goals / Non-Goals

**Goals:**

- 清掉 generated image 与 agent badge 中剩余的高置信可见中文。
- 让 Claude MCP 路由提示在英文 locale 下不再泄露中文。
- 用最小代码改动完成，不改变行为语义。

**Non-Goals:**

- 不清理正则、启发式词表、内部 detail 拼接文案。
- 不扩展生成图片流程或 MCP 路由策略。

## Decisions

### Decision 1: 优先复用已有 generated image key，不保留组件内中文 fallback

- 方案 A：继续保留组件内中文 fallback，防止 locale key 缺失
- 方案 B：既然 locale key 已存在，就直接使用 key，不再在组件里内嵌中文兜底

选择 B。

原因：

- 这些 key 在中英文 locale 中已经存在，保留中文硬兜底只会制造再次泄露风险。
- 一旦 key 缺失，测试会更早暴露问题，比静默回落到中文更可控。

### Decision 2: 新增 agent badge / MCP route notice 专用 key，而不是拼接中英混合文本

- 方案 A：在代码里继续模板拼接中英混合文案
- 方案 B：把用户可见文案抽成清晰的 i18n key，并只把变量部分插值进去

选择 B。

原因：

- 这类解释性 copy 在英文 locale 下最容易出现“主体英文、括号中文”的漂移。
- key 化后，测试与后续维护都更稳定。

## Risks / Trade-offs

- [Risk] 移除 generated image 中文 fallback 后，如果测试桩漏 key 会直接显示 key
  → Mitigation：同步补齐 `vitest.setup.ts` 中的映射并更新相关测试断言。

- [Risk] MCP 路由提示测试当前直接断言中文 notice
  → Mitigation：更新对应测试，改为按 locale key 期望值断言。

## Migration Plan

1. 新增/补齐 agent badge 与 MCP route notice key。
2. 替换 `MessagesRows.tsx` 和 `useThreadMessaging.ts` 中的硬编码 copy。
3. 更新 focused tests 并执行验证。

## Open Questions

- 无。
