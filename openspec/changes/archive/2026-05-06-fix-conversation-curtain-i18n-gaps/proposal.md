## Why

当前 conversation curtain 在英文 locale 下仍有多处用户可见标题直接写死为中文，导致实时幕布、历史恢复态和工具兜底展示出现中英文混杂。这个问题已经在 issue #514 暴露，但实际影响面不止 `MessagesTimeline`，还包括 `requestUserInputSubmitted` 审计项与工具展示名 fallback。

## What Changes

- 将 conversation curtain 中的 turn boundary 标题改为通过 i18n key 渲染，而不是直接写死中文。
- 将 `requestUserInputSubmitted` 的用户可见标题统一改为 locale-driven 文案，覆盖 realtime、history replay 和本地合成路径。
- 将工具展示名 fallback 中仍然写死中文的可见文案收口到可复用的 locale contract，避免 `t()` 不可用时泄露中文。
- 为本次修复补齐最小测试，确保幕布关键标题在受影响路径上不再依赖硬编码中文。

## 目标与边界

- 目标：修复幕布用户可见 surface 中遗漏的 i18n 文案，使中英文切换下的 turn boundary、user-input audit item 和工具标题保持一致。
- 边界：只处理 conversation curtain / tool card / requestUserInputSubmitted 相关可见标题，不重构整套 locale 结构，不改业务消息正文，不触碰解析正则、测试样例里的中文 fixture。

## 非目标

- 不对所有 feature 做仓库级“中文硬编码大扫除”。
- 不新增语言种类，只保持现有 `zh` / `en` contract。
- 不改变 `requestUserInputSubmitted` payload schema、toolType 或持久化结构。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `conversation-render-surface-stability`: conversation curtain 的 turn boundary 与相关可见标题需要遵循 locale-driven render contract，不能在生产 UI 中写死中文。
- `codex-chat-canvas-user-input-elicitation`: `requestUserInputSubmitted` 审计项标题需要按 locale 渲染，并在实时态、历史恢复态和本地提交回写路径中保持一致语义。

## Impact

- Affected frontend code:
  - `src/features/messages/components/MessagesTimeline.tsx`
  - `src/features/messages/components/toolBlocks/toolConstants.ts`
  - `src/features/threads/loaders/claudeHistoryLoader.ts`
  - `src/features/threads/hooks/useThreadUserInput.ts`
  - `src/utils/threadItems.ts`
  - `src/i18n/locales/*`
- Affected tests:
  - `Messages.turn-boundaries.test.tsx`
  - `useThreadUserInput.test.tsx`
  - `threadItems.test.ts`
  - `claudeHistoryLoader.test.ts`
