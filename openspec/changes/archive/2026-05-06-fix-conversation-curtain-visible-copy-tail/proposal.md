## Why

conversation curtain 的首轮 i18n 修复后，幕布里仍残留少量高置信用户可见中文文案，主要集中在 generated image 卡片、agent badge 的可访问名称，以及 Claude MCP 路由提示。它们数量不多，但会继续在英文 locale 下泄露中文，属于“尾债”而不是新功能。

## What Changes

- 将 generated image 卡片中仍写死在组件 fallback 里的标题、状态、说明与预览按钮标签接入 locale contract。
- 将 user message agent badge 的 `aria-label` 改为 i18n 文案，避免辅助功能 surface 混入中文。
- 将 Claude MCP 路由提示接入 i18n，保证英文 locale 下的解释性 notice 不再泄露中文。
- 补齐最小测试，覆盖 generated image 与 agent badge 的关键 visible copy。

## 目标与边界

- 目标：清掉 conversation curtain 相关高置信可见文案尾债，保证英文 locale 下不再混入残留中文。
- 边界：只处理幕布与其直接关联 notice surface 的显式可见 copy，不改正则兼容词、诊断内部 schema、启发式中文关键词和用户正文内容。

## 非目标

- 不做仓库级中文硬编码大扫除。
- 不重构 generated image/card 结构或 MCP 路由行为。
- 不处理 `useThreads.ts` 中偏内部 detail 拼接的记忆摘要文案。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `conversation-render-surface-stability`: generated image 卡片、agent badge 可访问名称等幕布可见文案需要遵循 locale-driven contract。
- `thread-messaging-session-tooling-compatibility`: Claude MCP 路由提示的用户可见 copy 需要按 locale 输出，避免解释性 notice 泄露中文。

## Impact

- Affected code:
  - `src/features/messages/components/MessagesRows.tsx`
  - `src/features/threads/hooks/useThreadMessaging.ts`
  - `src/i18n/locales/en.part1.ts`
  - `src/i18n/locales/en.part2.ts`
  - `src/i18n/locales/zh.part1.ts`
  - `src/i18n/locales/zh.part2.ts`
- Affected tests:
  - `src/features/messages/components/Messages.rich-content.test.tsx`
  - `src/features/messages/components/Messages.user-input.test.tsx`
  - `src/features/threads/utils/claudeMcpRuntimeSnapshot.test.ts`
