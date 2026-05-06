## 1. Locale Contract

- [x] 1.1 为 agent badge 与 MCP route notice 补齐 locale key（输入：现有 messages/threads key；输出：中英文可见文案 contract；验证：locale 文件与测试桩键名齐全）。
- [x] 1.2 确认 generated image 组件直接复用现有 key，移除中文 fallback（输入：现有 generated image locale key；输出：组件内不再写死中文；验证：rich content 测试可覆盖）。

## 2. Curtain Copy Cleanup

- [x] 2.1 将 `MessagesRows.tsx` 中 agent badge 与 generated image 文案改为纯 i18n 渲染（输入：当前组件 fallback copy；输出：英文 locale 下无中文残留；验证：Messages rich-content / user-input 测试通过）。
- [x] 2.2 将 `useThreadMessaging.ts` 中 Claude MCP 路由提示改为 locale-driven notice（输入：notice 拼接逻辑；输出：用户可见提示跟随 locale；验证：claudeMcpRuntimeSnapshot / 相关 hook 测试通过）。

## 3. Verification

- [x] 3.1 更新 focused tests 与测试桩（输入：MessagesRows / MCP notice 断言；输出：新 copy 对齐；验证：相关 Vitest 通过）。
- [x] 3.2 运行 focused verification 与 OpenSpec 校验（输入：受影响测试文件与 change；输出：验证通过；验证：Vitest + openspec validate 绿灯）。
