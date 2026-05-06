# Fix conversation curtain i18n gaps

## Goal

修复幕布可见 surface 中遗漏的硬编码中文，确保英文 locale 下不会再在 turn boundary、工具标题和 requestUserInputSubmitted 审计项里看到中文残留。

## Requirements

- 将 `MessagesTimeline` turn boundary 标题改为 i18n key。
- 将 `requestUserInputSubmitted` 标题在 realtime / history / normalization 三条路径上统一到 locale-driven 文案。
- 收口 `toolConstants` 中会直接进入可见面的中文 fallback。
- 补最小测试，避免恢复态和实时态只修一边。

## Acceptance Criteria

- [ ] 英文 locale 下，turn boundary 不再显示“推理过程”“最终消息”。
- [ ] 英文 locale 下，`requestUserInputSubmitted` 不再显示“请求输入”。
- [ ] 英文 locale 下，`webfetch` fallback 不再显示“网页获取”。
- [ ] 受影响 focused tests 通过。

## Technical Notes

- 优先复用已有 `approval.inputRequested`、`tools.webFetch` 等 key，避免重复建模。
- 仅修正用户可见标题来源，不改变 payload schema、toolType、history replay 结构。
