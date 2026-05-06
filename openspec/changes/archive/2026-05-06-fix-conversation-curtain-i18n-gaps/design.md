## Context

conversation curtain 的可见标题并不只来自单一 TSX render 层，而是分散在三条链路：

1. realtime render surface：例如 `MessagesTimeline` 的 turn boundary；
2. history replay / local normalization：例如 `claudeHistoryLoader`、`threadItems` 生成的 `requestUserInputSubmitted` 审计项；
3. tool display fallback：例如 `toolConstants` 在翻译函数缺失时使用的静态映射。

issue #514 只显式指出了 turn boundary 的中文残留，但实际用户在英文界面仍会看到“请求输入”“网页获取”等中文文案。因此需要把这些语义统一收口到已有 i18n contract，而不是单点修补。

## Goals / Non-Goals

**Goals:**

- 让 conversation curtain 中受影响的用户可见标题全部通过 locale 资源渲染。
- 让 `requestUserInputSubmitted` 在实时提交、历史恢复和本地归一化三条路径上使用同一语义文案。
- 保持现有 payload schema、toolType、thread normalization 行为不变，只修正文案来源。

**Non-Goals:**

- 不把所有历史遗留中文常量一次性全部迁移。
- 不修改 tool block 的结构、状态机或审批/提问业务逻辑。
- 不新增 runtime locale loader 或额外依赖。

## Decisions

### Decision 1: turn boundary 使用新的 `messages.*` key，而不是复用现有 thinking label

- 方案 A：直接复用 `messages.thinkingProcess` / `messages.thinkingLabel`
- 方案 B：新增边界语义专用 key，例如 `messages.reasoningProcessBoundary` / `messages.finalMessageBoundary`

选择 B。

原因：

- `thinkingProcess` 当前更偏向 reasoning row / state label 语义，不等价于 turn boundary。
- `finalMessage` 目前没有现成 key，新增 boundary key 更清晰，也避免后续 UI 文案互相牵连。

### Decision 2: `requestUserInputSubmitted` 标题统一复用已有 `approval.inputRequested`

- 方案 A：新增 `messages.requestUserInputSubmittedTitle`
- 方案 B：复用现有 `approval.inputRequested`

选择 B。

原因：

- 该语义在现有产品里已经稳定存在，且中英文资源齐全。
- 这次修的是“标题来源漂移”，不是创造新文案概念；复用已有 key 更少 drift。

### Decision 3: fallback 中文常量改为 locale-neutral fallback，优先英文

- 方案 A：保留中文 fallback，仅在 `t()` 不可用时显示中文
- 方案 B：把 fallback 改为英文或 locale-neutral 文案

选择 B。

原因：

- fallback 不能假设当前 locale 是中文，否则英文 UI 会继续漏中文。
- 现有静态 fallback 无法感知运行时语言，英文是更安全的 cross-locale 最小兜底。

## Risks / Trade-offs

- [Risk] 测试里有直接断言中文标题，改 key 后会失败
  → Mitigation：只更新与本次可见标题相关的断言，保持 payload/schema 断言不变。

- [Risk] `requestUserInputSubmitted` 标题在不同路径被多处生成，漏改会导致实时态和恢复态不一致
  → Mitigation：同时覆盖 `useThreadUserInput`、`claudeHistoryLoader`、`threadItems` 三个来源。

- [Risk] fallback 改成英文可能影响中文 locale 下极端兜底显示
  → Mitigation：主路径依然优先 `t()`；只有翻译上下文缺失时才进入 fallback，优先保证非中文 locale 不泄露中文。

## Migration Plan

1. 新增/补齐 locale key。
2. 将 turn boundary、user-input submitted 标题、tool fallback 接入 key。
3. 更新受影响测试并执行 focused verification。
4. 若出现回归，回滚局部 key 替换即可，无数据迁移需求。

## Open Questions

- 无。当前需求边界已足够明确，且不涉及跨层协议变更。
