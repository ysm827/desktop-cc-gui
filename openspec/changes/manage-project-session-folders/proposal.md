## Why

项目左侧工作区的 session 数量增长后，当前扁平列表已经无法支撑有效管理；用户需要用父子文件夹把同一项目内的会话分组、收纳，并通过明确的菜单操作完成移动。

同时，`Codex`、`Claude Code`、`Gemini` 三类引擎的历史会话归属与展示口径不一致，尤其是 Claude Code 部分历史无法在对应项目中正确显示，导致用户误以为会话丢失。

典型用户故事：

- 作为新手用户，我希望在项目旁边直接看到“新建文件夹”入口，把调试、需求、重构类 session 分开放，而不是在几十条会话里翻找。
- 作为经常同时使用 Codex 与 Claude Code 的用户，我希望同一项目的两类历史都能正确出现在项目里，不需要猜它们被藏到哪里。
- 作为谨慎用户，我希望系统在移动 session 前后都校验项目归属，避免错误入口污染 session owner。

## 当前代码回写快照

基于当前代码，`manage-project-session-folders` 已经不是纯提案状态，而是进入“主体能力已落地、hardening 待补齐”的状态：

- 后端已有 `list/create/rename/move/delete/assign_workspace_session_folder` Tauri commands，folder metadata 存在 `session-management/workspaces/<workspaceId>.json`，包含 `folders` 与 `folderIdBySessionId`。
- Folder CRUD 已支持空树默认态、nested folder、稳定排序、cycle rejection、非空 folder 删除阻止。
- Session catalog entry 已包含 `folderId`，前端 sidebar 会把当前 project projection 按 folder assignment 分组；缺失或失效 assignment 会回落到 project root。
- 右键/菜单路径已支持 `Move to folder`，目标列表由当前 project 的 folder tree 构造，并包含 root target。
- Archive 会保留 folder assignment；delete 成功后会清理 archive state 与 folder assignment，避免 dangling assignment。
- Codex、Claude Code、Gemini 已进入统一 catalog/projection 模型；Claude/Gemini scanner 失败会通过 partial source/degraded marker 暴露，不阻塞其它 engine 结果。
- 当前实现仍有明确缺口：assignment command 只验证 target folder 属于目标 workspace，还没有反查 source session 的真实 owner；metadata 写入仍是普通 read-modify-write；后端仍先扫描/构造完整候选再分页；folder collapsed state 仅为组件内存态；大量 folder 的 Move 菜单仍是线性长列表。

## 目标与边界

### 目标

- 在左侧工作区项目区域增加 session folder tree，用父子层级管理当前项目内的 sessions。
- 提供菜单移动路径，使用户可以通过 session 菜单选择 `Move to folder` 完成同项目移动；该能力当前已落地。
- 明确禁止跨项目移动 session，避免 owner workspace 与底层历史文件归属被污染。
- 梳理 `Codex`、`Claude Code`、`Gemini` 三大引擎的历史会话查询与 project attribution contract，其中 Codex 与 Claude Code 是 P0 正确性目标，Gemini 是 best-effort 可见性目标。
- 修复 Claude Code 历史在对应项目中漏显的问题，使可归属历史能稳定出现在正确项目内。
- 补齐 v0.4.14 后续 hardening：folder assignment command 必须验证 source session 真实属于目标 project scope，metadata 写入必须避免 read-modify-write 覆盖，catalog pagination 不应在后端无界扫描后再分页。
- 持久化 folder tree 展开状态，并在 folder 目标较多时提供可搜索/可扫描的移动入口，降低长期项目的整理成本。

### 边界

- 本提案只定义项目内 session folder 管理与三引擎历史查询归属，不实现云同步、多设备共享或团队级权限。
- Folder tree 是应用侧组织层，不改变底层引擎原始 transcript/history 文件的存储格式。
- 跨项目移动在本轮明确禁止；未来若要支持，必须单独设计 owner migration 与 destructive risk gate。
- Hardening 只加固当前 file-based metadata 与 catalog contract，不在本轮引入数据库、云同步或跨设备状态共享。

## 非目标

- 不把 folder tree 设计成通用文件系统浏览器。
- 不支持 folder 直接跨 project 复制或移动。
- 不实现 session-to-folder drag and drop；本轮以菜单移动作为唯一 session folder assignment 入口。
- 不重写现有 chat runtime、thread execution 或 transcript parser。
- 不承诺把无法获得足够 metadata 的历史强行归属到某项目。
- 不新增数据库依赖；优先沿用现有 file-based storage 与 workspace/session catalog 模型。

## What Changes

- 新增 `workspace-session-folder-tree` capability：
  - 每个 project/workspace 拥有独立的 session folder tree。
  - Folder 支持创建、重命名、删除、父子层级调整；当前代码已通过后端 command 与 sidebar inline/context menu 落地。
  - Session 支持同项目内 folder assignment 变更；当前已通过右键/菜单 `Move to folder` 落地。
  - UI 支持 folder expand/collapse 与 folder 内 session 展示；collapsed state 当前只保存在组件 state，尚未跨刷新持久化。
  - Move contract 必须验证 source project 与 target project 一致。
- 修改 `workspace-session-management`：
  - 项目 session catalog 返回 folder assignment 或等价组织 metadata；当前已在 catalog entry 暴露 `folderId`。
  - Archive、delete、unarchive、query、pagination 不得被 folder 组织层破坏；当前 archive/delete metadata 行为已覆盖，bounded backend pagination 仍待加固。
  - Folder 删除时必须有明确策略：当前采用阻止删除非空 folder。
  - Session folder assignment mutation 必须在 command 层验证 source session owner/project scope，不得只依赖调用方传入的 workspace id；当前仅完成 target folder existence/workspace 隔离，source owner 反查仍待实现。
  - Folder metadata 的 create/rename/move/delete/assign 必须通过 workspace-scoped atomic mutation 或等价锁保护，避免并发 read-modify-write 覆盖；当前仍为普通 JSON read-modify-write。
- 修改 `workspace-session-catalog-projection`：
  - Sidebar / Workspace Home / Session Management 继续共享同一 strict project scope resolver。
  - Folder tree 只作为当前 project projection 的 presentation/organization layer，不扩大 session membership。
  - 后端 catalog page construction 应支持 bounded page acquisition；当前 `build_catalog_page` 只在已构造候选集后分页，Codex/Claude/Gemini/OpenCode scanner 侧仍有无界或大范围扫描风险。
- 修改 `workspace-session-folder-tree`：
  - Folder expand/collapse state 应可跨刷新恢复，且不得影响 session owner 或 folder assignment truth。
  - 当同一 project folder target 数量较多时，菜单移动入口应支持搜索或分组扫描，避免长菜单不可用。
- 修改 `session-history-project-attribution`：
  - Attribution 从 Codex 扩展到 `Codex`、`Claude Code`、`Gemini` 三类 engine。
  - 每条历史必须携带 engine/source、canonical session identity、owner workspace/project 或 unresolved marker。
  - Codex 与 Claude Code 历史必须根据 transcript metadata、cwd、project path、known workspace catalog 等证据做 project attribution。
  - Gemini 历史在 metadata 足够时参与同一 attribution contract；metadata 不足时保留在 global/unassigned，而不是阻塞本提案交付。
- 修改 `global-session-history-archive-center`：
  - 全局历史中心支持按 engine 查询 `Codex`、`Claude Code`、`Gemini` 历史。
  - Project view 与 global view 的同一 canonical session 状态保持一致。

## 技术方案对比与取舍

| 方案 | 描述 | 优点 | 风险/成本 | 结论 |
|---|---|---|---|---|
| A | 只在前端本地维护临时 folder UI state | 改动最快 | 刷新后丢失，无法被 catalog/query/mutation 复用，不能支撑长期管理 | 不采用 |
| B | 在 workspace session catalog 增加轻量 folder assignment metadata | 兼容现有 file-based storage，改动面可控，能保持 owner routing | 需要补 migration/default folder 与 command-level owner validation | **采用** |
| C | 引入完整数据库/树形索引服务重做 session catalog | 查询能力最强 | 对当前需求过重，会放大迁移、备份、跨平台风险 | 不采用 |
| D | 在现有 file-based metadata 上增加 per-workspace atomic mutation helper | 改动小，能消除并发覆盖风险，保留当前存储模型 | 不能解决所有跨进程写入竞争，仍需后续观察 | **采用** |

取舍：采用 B。Folder tree 是当前项目 session 的组织层，不是新的 truth source；真实归属仍由 session catalog 与 engine history attribution 决定。

## Capabilities

### New Capabilities

- `workspace-session-folder-tree`: 定义项目内 session folder tree、父子层级、同项目菜单移动、跨项目移动保护与 folder assignment 行为。

### Modified Capabilities

- `workspace-session-management`: 项目会话管理需要感知 folder assignment，并保证 archive/delete/unarchive/query 与 folder 组织层一致。
- `workspace-session-catalog-projection`: 默认 workspace session projection 需要允许 folder organization，但不得改变 strict project membership。
- `session-history-project-attribution`: 从 Codex-only 归属扩展为 `Codex`、`Claude Code`、`Gemini` 三引擎归属，重点补齐 Claude Code project history 漏显。
- `global-session-history-archive-center`: 全局历史中心从 Codex-only 扩展为按 engine 查询三大引擎历史。

## 验收标准

- 用户可以从项目行或项目菜单中发现 `New folder` 入口，并能理解该入口创建的是当前项目内的 session folder。
- 项目没有 folder 时，系统必须以 root session list 作为默认态，不得出现空白树或让用户误以为 session 丢失。
- 用户可以在某个项目下创建多层 session folder，并看到父子树形结构。
- 用户可以通过 session 菜单或等价操作把 session 移动到同项目 folder/root；当前代码已支持。
- 当用户尝试通过菜单、命令或其它入口把 session 移到另一个项目或另一个项目的 folder 时，系统必须阻止并给出明确反馈。
- Folder assignment 变化后，session 的真实 owner workspace/project 不得改变。
- Folder assignment command 必须拒绝不属于当前 project/workspace scope 的 source session，即使 target folder 存在。
- 并发 folder CRUD 与 assignment 不得丢失已经成功写入的 metadata 变更。
- Folder tree 不得影响 archive、unarchive、delete、query、pagination 的正确性。
- 大历史项目首屏 catalog 加载必须保持 bounded；后端不得在首屏请求中持续翻页直到耗尽全部历史。
- 用户刷新应用后，folder expand/collapse 状态应该恢复到上次保存的 project-local 状态。
- 当可移动 folder target 很多时，用户必须能通过搜索或等价扫描方式定位目标 folder/root。
- Codex 与 Claude Code 历史会话必须在对应项目中按统一 attribution contract 查询与展示。
- Claude Code 历史如果具备可归属证据，必须出现在对应项目的 session catalog 或 related surface 中。
- Gemini 历史如果具备可归属证据，应该进入同一查询模型；证据不足时必须保留在 global/unassigned 或 degraded 状态，不得影响 Codex/Claude Code 的正确性。
- 缺失 metadata 或候选项目不唯一的历史必须保留为 unresolved/unassigned，不得强行归属或静默丢弃。
- 三引擎任一 history source 扫描失败时，其它 source 的结果仍可返回，并暴露 degraded marker。

## Impact

- Affected behavior specs:
  - 新增 `openspec/specs/workspace-session-folder-tree/spec.md`
  - 修改 `openspec/specs/workspace-session-management/spec.md`
  - 修改 `openspec/specs/workspace-session-catalog-projection/spec.md`
  - 修改 `openspec/specs/session-history-project-attribution/spec.md`
  - 修改 `openspec/specs/global-session-history-archive-center/spec.md`
- Likely affected frontend:
  - workspace sidebar / project list session surface
  - session management settings surface
  - session tree rendering and empty states
- Likely affected backend:
  - workspace/session catalog read model
  - folder assignment persistence
  - session move validation command
  - Codex / Claude Code / Gemini history scanners and attribution adapters
- Validation focus:
  - folder CRUD and nested rendering
  - same-project menu move success
  - cross-project move rejection
  - menu-based move path
  - folder assignment persistence across refresh
  - assignment source owner validation
  - concurrent metadata mutation preservation
  - backend bounded pagination / scanner limit behavior
  - folder collapse state persistence
  - large folder target move-menu usability
  - Claude Code project history attribution regression
  - Codex history attribution regression
  - Gemini best-effort degraded/unassigned behavior
