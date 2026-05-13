## 1. Spec And Contract

- [x] 1.1 [P0][depends: none][input: `openspec/specs/claude-cli-settings-doctor/spec.md`, `openspec/specs/cli-execution-backend-parity/spec.md`][output: finalized installer capability boundaries][verify: OpenSpec review] Confirm installer scope stays limited to Codex / Claude Code and does not modify Gemini / OpenCode runtime gates.
- [x] 1.2 [P0][depends: 1.1][input: proposal/design][output: `cli-one-click-installer` delta spec][verify: `openspec validate --all --strict --no-interactive`] Define install plan, confirmation, command whitelist, post-install doctor, and platform boundary requirements.
- [x] 1.3 [P0][depends: 1.1][input: existing remote backend parity spec][output: remote installer parity delta][verify: `openspec validate --all --strict --no-interactive`] Define remote daemon execution semantics for installer plan/run.

## 2. Backend Installer Core

- [ ] 2.1 [P0][depends: 1.2][input: `src-tauri/src/codex/doctor.rs`, existing PATH helpers][output: installer preflight helper][verify: Rust unit tests] Detect Node/npm availability, target platform, current engine availability, and npm global prefix blocker without mutating environment.
- [ ] 2.2 [P0][depends: 2.1][input: allowed engine/action matrix][output: whitelisted install plan builder][verify: Rust unit tests] Build runnable Phase 1 plans only from enum inputs: `codex|claude`, `installLatest|updateLatest`, `npmGlobal`; keep `cliSelfUpdate` unsupported/future-only.
- [ ] 2.3 [P0][depends: 2.2][input: process command helpers][output: local installer runner][verify: Rust unit tests with command construction assertions] Execute npm `@latest` installer with argv/process builder, not raw shell strings.
- [ ] 2.4 [P0][depends: 2.3][input: doctor commands][output: post-install doctor chaining][verify: Rust unit tests or integration-style tests] Automatically run `codex_doctor` or `claude_doctor` after installer completion and attach result.
- [ ] 2.5 [P1][depends: 2.3][input: stdout/stderr output][output: redacted and truncated result summaries][verify: Rust unit tests] Limit installer logs and redact sensitive patterns.

## 3. Remote Backend Parity

- [ ] 3.1 [P0][depends: 2.2][input: `src-tauri/src/remote_backend.rs`, daemon RPC registry][output: remote install plan forwarding][verify: Rust request-shape tests] Forward install plan requests to remote daemon when `backendMode = remote`.
- [ ] 3.2 [P0][depends: 2.3][input: remote backend call path][output: remote installer run forwarding][verify: Rust request-shape tests] Execute installer only in daemon environment for remote mode.
- [ ] 3.3 [P1][depends: 3.1][input: old daemon compatibility][output: explainable unsupported-daemon error][verify: targeted test] Return a clear error when remote daemon does not expose installer RPC.

## 4. Frontend UX

- [ ] 4.1 [P0][depends: 2.2][input: `CodexSection.tsx`, doctor state][output: install/update button visibility rules][verify: focused Vitest] Show install/update actions only for Codex / Claude Code and only when plan says action can be offered or manual fallback is useful.
- [ ] 4.2 [P0][depends: 4.1][input: install plan bridge][output: confirmation modal][verify: focused Vitest] Display engine, action, backend, platform, command preview, blockers, warnings, and manual fallback before execution.
- [ ] 4.3 [P0][depends: 4.2][input: installer result bridge][output: result card with post-install doctor status][verify: focused Vitest] Show success/failure details and refresh doctor/engine status after completion.
- [ ] 4.4 [P1][depends: 4.1][input: translations][output: Chinese/English i18n strings][verify: typecheck / snapshot if applicable] Add concise user-facing copy for safe install boundaries.

## 5. Cross-Platform Validation

- [ ] 5.1 [P0][depends: 2-4][input: backend tests][output: command whitelist and preflight tests pass][verify: `cargo test --manifest-path src-tauri/Cargo.toml cli_installer`] Run focused Rust tests.
- [ ] 5.2 [P0][depends: 4][input: frontend tests][output: settings installer UI tests pass][verify: focused Vitest] Run focused Vitest for install button/confirm/result flows.
- [ ] 5.3 [P0][depends: 2-4][input: cross-layer types][output: TypeScript contracts valid][verify: `npm run typecheck`] Run typecheck.
- [ ] 5.4 [P1][depends: 2-4][input: macOS local environment][output: macOS manual smoke notes][verify: manual] Verify install/update plan and post-install doctor on macOS.
- [ ] 5.5 [P1][depends: 2-4][input: Windows native environment][output: Windows manual smoke notes][verify: manual] Verify npm `.cmd` path, install/update plan, and post-install doctor on Windows.
- [ ] 5.6 [P1][depends: 3][input: remote daemon environment][output: remote manual smoke notes][verify: manual] Verify remote installer acts on daemon environment and local desktop is not modified.
- [ ] 5.7 [P1][depends: 2][input: WSL boundary case][output: WSL boundary notes][verify: manual or documented test] Verify Windows desktop does not cross-install into WSL unless using remote daemon inside WSL/Linux.
