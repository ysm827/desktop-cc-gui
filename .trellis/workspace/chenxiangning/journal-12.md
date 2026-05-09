# Journal - chenxiangning (Part 12)

> Continuation from `journal-11.md` (archived at ~2000 lines)
> Started: 2026-05-09

---



## Session 389: 修复跨平台 CI 前置契约

**Date**: 2026-05-09
**Task**: 修复跨平台 CI 前置契约
**Branch**: `feature/v0.4.15`

### Summary

(Add summary)

### Main Changes

修复 PR #521 中两类 CI 前置契约失败：

- Windows doctor 的 `check-branding` 使用 `fileURLToPath(new URL(...))` 解析仓库根路径，避免 URL pathname 在 Windows 上形成 `D:\D:\...` 双盘符路径。
- macOS Rust CI 的 `memory-kind-contract` 与 `test-tauri` 在 `cargo test` 前执行 `npm run build`，确保 Tauri build script 依赖的 `../dist/*` 资源存在。

验证：
- `npm run check:branding`
- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml classify_kind_matches_contract_samples`
- `git diff --check -- .github/workflows/ci.yml scripts/check-branding.mjs`

注意：本次提交只包含 `.github/workflows/ci.yml` 与 `scripts/check-branding.mjs`，工作区其他未提交业务改动未纳入提交。


### Git Commits

| Hash | Message |
|------|---------|
| `684395ca` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 390: 轻量准备 Tauri 测试资源

**Date**: 2026-05-09
**Task**: 轻量准备 Tauri 测试资源
**Branch**: `feature/v0.4.15`

### Summary

(Add summary)

### Main Changes

修复上一轮 CI 修复引入的 macOS runner Vite build OOM：

- 将 `memory-kind-contract` 与 `test-tauri` job 中的完整 `npm run build` 前置步骤替换为轻量 `dist` 占位资源准备。
- 占位步骤创建 `dist/index.html` 与 `dist/assets/ci-placeholder.txt`，满足 Tauri build script 对 `frontendDist` 与 bundle resources glob 的编译期契约。
- 避免 Rust unit tests 为了资源 glob 触发完整 Vite production build，从而规避 GitHub macOS runner 默认 Node heap 下的 out-of-memory。

验证：
- `git diff --check -- .github/workflows/ci.yml`
- `cargo test --manifest-path src-tauri/Cargo.toml classify_kind_matches_contract_samples`

注意：本次提交只包含 `.github/workflows/ci.yml` follow-up 修复，工作区其他未提交业务改动未纳入提交。


### Git Commits

| Hash | Message |
|------|---------|
| `b1f43c8a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
