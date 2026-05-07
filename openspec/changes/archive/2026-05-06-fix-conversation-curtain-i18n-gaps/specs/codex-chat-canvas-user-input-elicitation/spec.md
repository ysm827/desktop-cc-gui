## MODIFIED Requirements

### Requirement: askuserquestion Semantic Mapping

系统 MUST 在工具展示层将 `askuserquestion` 与 `requestUserInput` 语义对齐，并与官方 `Plan Mode` / `Default` 术语保持一致。

#### Scenario: request user input submitted audit title follows locale

- **WHEN** 系统渲染 `requestUserInputSubmitted` 审计项
- **THEN** 该项标题 MUST 使用 locale-driven 文案
- **AND** realtime submit、history replay 与本地归一化补全路径 MUST 使用一致语义
- **AND** 系统 MUST NOT 在这些用户可见路径中将 `"请求输入"` 写死为生产 UI 标题

#### Scenario: tool display fallback does not leak Chinese in non-Chinese locale

- **WHEN** 工具展示层缺少翻译函数上下文或进入静态 fallback 路径
- **THEN** `webfetch`、`askuserquestion` 等用户可见标题 MUST 使用 locale-safe fallback
- **AND** fallback MUST NOT 默认泄露中文标题到英文界面
