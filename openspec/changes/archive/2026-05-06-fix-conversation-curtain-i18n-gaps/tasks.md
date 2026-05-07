## 1. OpenSpec And Locale Contract

- [x] 1.1 为 conversation curtain turn boundary 定义并补齐 locale key（输入：现有 `messages` 文案集合；输出：中英文边界标题 key；验证：locale 文件可解析且键名稳定）。
- [x] 1.2 确认 `requestUserInputSubmitted` 与工具 fallback 复用/新增的 i18n key（输入：现有 `approval` / `tools` key；输出：统一语义映射；验证：不引入平行重复 key）。

## 2. Curtain Surface Implementation

- [x] 2.1 将 `MessagesTimeline` 中的 reasoning/final boundary 标题改为 `t()` 渲染（输入：turn boundary render path；输出：locale-driven 标题；验证：边界渲染测试通过）。
- [x] 2.2 将 `requestUserInputSubmitted` 的标题生成路径改为统一 i18n 语义（输入：`useThreadUserInput`、`claudeHistoryLoader`、`threadItems`；输出：实时态与恢复态一致标题；验证：对应单测通过）。
- [x] 2.3 将工具展示名 fallback 中的 `webfetch` 等可见标题改为 locale-safe fallback（输入：`toolConstants` fallback map；输出：不再默认泄露中文；验证：工具标题解析测试/渲染路径无回归）。

## 3. Verification

- [x] 3.1 更新受影响前端测试断言（输入：turn boundary 与 user-input 标题用例；输出：与新文案来源一致的断言；验证：focused Vitest 通过）。
- [x] 3.2 运行 focused verification 并回填任务状态（输入：受影响测试文件；输出：通过结果与已完成 tasks；验证：`npm run test -- --runInBand <focused files>` 或等价 vitest 命令成功）。
