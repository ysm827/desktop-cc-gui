// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUseSpecHubState,
  getChangeGroupToggle,
  isReactActWarning,
  mockDetectEngines,
  mockEngineSendMessageSync,
  mockPickImageFiles,
  mockUseSpecHub,
  openOrFocusDetachedSpecHubMock,
  originalConsoleError,
} from "./SpecHub.test-support";
import { SpecHub } from "./SpecHub";
import { useSpecHub } from "../hooks/useSpecHub";

vi.mock("../hooks/useSpecHub", () => ({
  useSpecHub: vi.fn(),
}));

describe("SpecHub", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

  afterEach(() => {
    cleanup();
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = null;
    vi.clearAllMocks();
    openOrFocusDetachedSpecHubMock.mockClear();
  });

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
      if (isReactActWarning(args)) {
        return;
      }
      originalConsoleError(...args);
    });
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded") as ReturnType<typeof useSpecHub>,
    );
  });

  it("maps no verify evidence gate message to i18n key", () => {
    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Gate" }));

    expect(screen.getByText("NO_VERIFY_EVIDENCE")).toBeTruthy();
  });

  it("maps truncated artifact gate message with interpolation", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("Artifact evidence is truncated (tasks.md, specs). Re-read before archive.") as ReturnType<
        typeof useSpecHub
      >,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Gate" }));

    expect(screen.getByText("TRUNCATED tasks.md, specs")).toBeTruthy();
  });

  it("defaults to project tab and switches to actions on demand", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        actions: [
          {
            key: "verify",
            label: "Verify",
            commandPreview: "openspec validate change-1 --strict",
            available: true,
            blockers: [],
            kind: "native",
          },
        ],
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    expect(screen.queryByRole("button", { name: "Verify" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    expect(screen.getByRole("button", { name: "Verify" })).toBeTruthy();
  });

  it("renders actions with availability and blockers", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        actions: [
          {
            key: "verify",
            label: "Verify",
            commandPreview: "openspec validate change-1 --strict",
            available: true,
            blockers: [],
            kind: "native",
          },
          {
            key: "archive",
            label: "Archive",
            commandPreview: "openspec archive change-1 --yes",
            available: false,
            blockers: ["No strict verify evidence recorded"],
            kind: "native",
          },
        ],
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));

    const verifyButton = screen.getByRole("button", { name: "Verify" });
    const archiveButton = screen.getByRole("button", { name: "Archive" });

    expect(verifyButton.getAttribute("disabled")).toBeNull();
    expect(archiveButton.getAttribute("disabled")).not.toBeNull();
    expect(screen.getByText("NO_VERIFY_EVIDENCE")).toBeTruthy();
  });

  it("keeps verify behavior unchanged when auto-complete toggle is off", () => {
    const executeAction = vi.fn();
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        actions: [
          {
            key: "verify",
            label: "Verify",
            commandPreview: "openspec validate change-1 --strict",
            available: true,
            blockers: [],
            kind: "native",
          },
        ],
        executeAction,
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    const toggle = screen.getByRole("checkbox", { name: "Auto-complete" }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    expect(executeAction).toHaveBeenCalledWith("verify");
    expect(mockEngineSendMessageSync).not.toHaveBeenCalled();
  });

  it("runs auto-completion before verify when toggle is enabled and verification is missing", async () => {
    const executeAction = vi.fn();
    const refresh = vi.fn(async () => {});
    mockEngineSendMessageSync.mockResolvedValueOnce({
      engine: "codex",
      text: JSON.stringify({
        summary: "verification generated",
        verification_path: "openspec/changes/change-1/verification.md",
      }),
    });
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        actions: [
          {
            key: "verify",
            label: "Verify",
            commandPreview: "openspec validate change-1 --strict",
            available: true,
            blockers: [],
            kind: "native",
          },
        ],
        artifacts: {
          proposal: {
            type: "proposal",
            path: "openspec/changes/change-1/proposal.md",
            exists: true,
            content: "# p",
          },
          design: {
            type: "design",
            path: "openspec/changes/change-1/design.md",
            exists: true,
            content: "# d",
          },
          specs: {
            type: "specs",
            path: "openspec/changes/change-1/specs/spec-hub/spec.md",
            exists: true,
            content: "# s",
            truncated: false,
            sources: [],
          },
          tasks: {
            type: "tasks",
            path: "openspec/changes/change-1/tasks.md",
            exists: true,
            content: "## Tasks",
            truncated: false,
            taskChecklist: [],
            taskProgress: { total: 1, checked: 1, requiredTotal: 1, requiredChecked: 1 },
          },
          verification: {
            type: "verification",
            path: null,
            exists: false,
            content: "",
          },
        },
        executeAction,
        refresh,
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Auto-complete" }));
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(mockEngineSendMessageSync).toHaveBeenCalled();
    });
    expect(refresh).toHaveBeenCalled();
    expect(executeAction).toHaveBeenCalledWith("verify");
    expect(screen.getByRole("dialog", { name: "Verify Auto-Completion Feedback" })).toBeTruthy();
  });

  it("skips auto-completion when verification artifact already exists", () => {
    const executeAction = vi.fn();
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        actions: [
          {
            key: "verify",
            label: "Verify",
            commandPreview: "openspec validate change-1 --strict",
            available: true,
            blockers: [],
            kind: "native",
          },
        ],
        artifacts: {
          proposal: {
            type: "proposal",
            path: "openspec/changes/change-1/proposal.md",
            exists: true,
            content: "# p",
          },
          design: {
            type: "design",
            path: "openspec/changes/change-1/design.md",
            exists: true,
            content: "# d",
          },
          specs: {
            type: "specs",
            path: "openspec/changes/change-1/specs/spec-hub/spec.md",
            exists: true,
            content: "# s",
            truncated: false,
            sources: [],
          },
          tasks: {
            type: "tasks",
            path: "openspec/changes/change-1/tasks.md",
            exists: true,
            content: "## Tasks",
            truncated: false,
            taskChecklist: [],
            taskProgress: { total: 1, checked: 1, requiredTotal: 1, requiredChecked: 1 },
          },
          verification: {
            type: "verification",
            path: "openspec/changes/change-1/verification.md",
            exists: true,
            content: "# verification",
          },
        },
        executeAction,
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Auto-complete" }));
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    expect(mockEngineSendMessageSync).not.toHaveBeenCalled();
    expect(executeAction).toHaveBeenCalledWith("verify");
  });

  it("still runs auto-completion when verification path is present but file is missing", async () => {
    const executeAction = vi.fn();
    mockEngineSendMessageSync.mockRejectedValueOnce(new Error("verification missing"));
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        actions: [
          {
            key: "verify",
            label: "Verify",
            commandPreview: "openspec validate change-1 --strict",
            available: true,
            blockers: [],
            kind: "native",
          },
        ],
        artifacts: {
          proposal: {
            type: "proposal",
            path: "openspec/changes/change-1/proposal.md",
            exists: true,
            content: "# p",
          },
          design: {
            type: "design",
            path: "openspec/changes/change-1/design.md",
            exists: true,
            content: "# d",
          },
          specs: {
            type: "specs",
            path: "openspec/changes/change-1/specs/spec-hub/spec.md",
            exists: true,
            content: "# s",
            truncated: false,
            sources: [],
          },
          tasks: {
            type: "tasks",
            path: "openspec/changes/change-1/tasks.md",
            exists: true,
            content: "## Tasks",
            truncated: false,
            taskChecklist: [],
            taskProgress: { total: 1, checked: 1, requiredTotal: 1, requiredChecked: 1 },
          },
          verification: {
            type: "verification",
            path: "openspec/changes/change-1/verification.md",
            exists: false,
            content: "",
          },
        },
        executeAction,
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Auto-complete" }));
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(mockEngineSendMessageSync).toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Verify Auto-Completion Feedback" })).toBeTruthy();
    });
    expect(executeAction).not.toHaveBeenCalled();
  });

  it("aborts verify when auto-completion fails and surfaces error", async () => {
    const executeAction = vi.fn();
    mockEngineSendMessageSync.mockRejectedValueOnce(new Error("network unavailable"));
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        actions: [
          {
            key: "verify",
            label: "Verify",
            commandPreview: "openspec validate change-1 --strict",
            available: true,
            blockers: [],
            kind: "native",
          },
        ],
        executeAction,
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Auto-complete" }));
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(screen.getByText("Auto-completion failed: network unavailable")).toBeTruthy();
      expect(
        screen.getAllByText("Auto-completion failed and strict validate was skipped for this run.").length,
      ).toBeGreaterThan(0);
    });
    expect(screen.getByRole("dialog", { name: "Verify Auto-Completion Feedback" })).toBeTruthy();
    expect(executeAction).not.toHaveBeenCalled();
  });

  it("shows continue ai enhancement feedback in floating dialog", async () => {
    const executeAction = vi.fn(async () => ({
      id: "evt-continue",
      at: Date.now(),
      kind: "action",
      action: "continue",
      command: "openspec instructions specs --change change-1",
      success: true,
      output: "continue output",
      validationIssues: [],
      gitRefs: [],
    }));
    mockEngineSendMessageSync.mockResolvedValueOnce({
      engine: "codex",
      text: JSON.stringify({
        summary: "ready for apply",
        recommended_next_action: "apply",
        suggested_scope: ["src/features/spec"],
      }),
    });
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        actions: [
          {
            key: "continue",
            label: "Continue",
            commandPreview: "openspec instructions specs --change change-1",
            available: true,
            blockers: [],
            kind: "native",
          },
        ],
        executeAction,
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "AI Enhancement" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Continue AI Enhancement Feedback" })).toBeTruthy();
    });
    expect(executeAction).toHaveBeenCalledWith("continue");
    expect(executeAction).toHaveBeenCalledWith(
      "apply",
      expect.objectContaining({
        applyMode: "execute",
        applyExecutor: "codex",
        applyUseContinueBrief: true,
        ignoreAvailability: true,
      }),
    );
    expect(mockEngineSendMessageSync).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({
        accessMode: "read-only",
      }),
    );
  });

  it("supports dragging verify auto-completion feedback and resets position after close", async () => {
    const executeAction = vi.fn(async () => {});
    mockEngineSendMessageSync.mockRejectedValueOnce(new Error("drag-check"));
    mockEngineSendMessageSync.mockRejectedValueOnce(new Error("drag-check-2"));
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        actions: [
          {
            key: "verify",
            label: "Verify",
            commandPreview: "openspec validate change-1 --strict",
            available: true,
            blockers: [],
            kind: "native",
          },
        ],
        executeAction,
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Auto-complete" }));
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    const dialog = await screen.findByRole("dialog", { name: "Verify Auto-Completion Feedback" });
    const initialLeft = dialog.getAttribute("style") ?? "";
    const header = dialog.querySelector(".spec-hub-apply-floating-header") as HTMLElement;
    fireEvent.pointerDown(header, { button: 0, clientX: 24, clientY: 24 });
    fireEvent.pointerMove(window, { clientX: 150, clientY: 180 });
    fireEvent.pointerUp(window);
    const movedStyle = dialog.getAttribute("style") ?? "";
    expect(movedStyle).not.toBe(initialLeft);

    fireEvent.click(screen.getByRole("button", { name: "Close verify auto-completion feedback" }));
    expect(screen.queryByRole("dialog", { name: "Verify Auto-Completion Feedback" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    const reopenedDialog = await screen.findByRole("dialog", { name: "Verify Auto-Completion Feedback" });
    expect(reopenedDialog.getAttribute("style") ?? "").toBe(initialLeft);
  });

  it("hides ai takeover panel before verify runs even when archive blockers exist", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        actions: [
          {
            key: "archive",
            label: "Archive",
            commandPreview: "openspec archive change-1 --yes",
            available: false,
            blockers: ["Archive preflight failed: delta MODIFIED requires existing openspec/specs/demo/spec.md"],
            kind: "native",
          },
        ],
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    expect(screen.queryByText("specHub.aiTakeover.title")).toBeNull();
  });

  it("shows ai takeover panel after verify runs when archive blockers exist", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        actions: [
          {
            key: "archive",
            label: "Archive",
            commandPreview: "openspec archive change-1 --yes",
            available: false,
            blockers: ["Archive preflight failed: delta MODIFIED requires existing openspec/specs/demo/spec.md"],
            kind: "native",
          },
        ],
        timeline: [
          {
            id: "verify-1",
            at: Date.UTC(2026, 1, 25, 3, 0, 0),
            kind: "validate",
            action: "verify",
            command: "openspec validate change-1 --strict",
            success: true,
            output: "strict validation passed",
            validationIssues: [],
            gitRefs: [],
          },
        ],
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    expect(screen.getByText("specHub.aiTakeover.title")).toBeTruthy();
  });

  it("renders doctor checks and hints", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        snapshot: {
          provider: "openspec",
          supportLevel: "full",
          specRoot: { source: "default", path: "openspec" },
          environment: {
            mode: "managed",
            status: "degraded",
            checks: [
              {
                key: "cli",
                label: "OpenSpec CLI",
                ok: false,
                value: "missing",
                detail: "Install openspec CLI",
              },
            ],
            blockers: ["OpenSpec CLI missing"],
            hints: ["Run npm i -g openspec"],
          },
          changes: [
            {
              id: "change-1",
              status: "ready",
              updatedAt: 1,
              artifacts: {
                proposalPath: "openspec/changes/change-1/proposal.md",
                designPath: "openspec/changes/change-1/design.md",
                tasksPath: "openspec/changes/change-1/tasks.md",
                verificationPath: null,
                specPaths: ["openspec/changes/change-1/specs/spec-hub/spec.md"],
              },
              blockers: [],
              archiveBlockers: [],
            },
          ],
          blockers: [],
        },
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    expect(screen.queryByRole("tab", { name: "Doctor" })).toBeNull();
    expect(screen.getByRole("button", { name: "Managed" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "BYO" })).toBeTruthy();
    expect(screen.getByText("OpenSpec CLI")).toBeTruthy();
    expect(screen.getByText("Install openspec CLI")).toBeTruthy();
    expect(screen.getByText("OpenSpec CLI missing")).toBeTruthy();
    expect(screen.getByText("Run npm i -g openspec")).toBeTruthy();
  });

  it("renders timeline entries with command and output", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        timeline: [
          {
            id: "evt-1",
            at: Date.UTC(2026, 1, 25, 2, 0, 0),
            kind: "validate",
            action: "verify",
            command: "openspec validate change-1 --strict",
            success: true,
            output: "strict validation passed",
            validationIssues: [],
            gitRefs: [],
          },
        ],
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Timeline" }));

    expect(screen.getByText("openspec validate change-1 --strict")).toBeTruthy();
    expect(screen.getByText("strict validation passed")).toBeTruthy();
  });

  it("routes apply action with selected executor in execute mode", async () => {
    const executeAction = vi.fn();
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        actions: [
          {
            key: "apply",
            label: "Apply",
            commandPreview: "openspec instructions tasks --change change-1",
            available: true,
            blockers: [],
            kind: "native",
          },
        ],
        executeAction,
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /Claude Code/ })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Execution engine"), {
      target: { value: "claude" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(executeAction).toHaveBeenCalledWith(
      "apply",
      expect.objectContaining({
        applyMode: "execute",
        applyExecutor: "claude",
      }),
    );
  });

  it("disables apply executor selector while action is running", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        isRunningAction: "apply",
        actions: [
          {
            key: "apply",
            label: "Apply",
            commandPreview: "openspec instructions tasks --change change-1",
            available: true,
            blockers: [],
            kind: "native",
          },
        ],
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    expect(screen.getByLabelText("Execution engine").getAttribute("disabled")).not.toBeNull();
  });

  it("routes apply action with OpenCode executor", async () => {
    const executeAction = vi.fn();
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        actions: [
          {
            key: "apply",
            label: "Apply",
            commandPreview: "openspec instructions tasks --change change-1",
            available: true,
            blockers: [],
            kind: "native",
          },
        ],
        executeAction,
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /OpenCode/ })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Execution engine"), {
      target: { value: "opencode" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(executeAction).toHaveBeenCalledWith(
      "apply",
      expect.objectContaining({
        applyMode: "execute",
        applyExecutor: "opencode",
      }),
    );
  });

  it("renders shared engine and icon-only proposal triggers in one row", () => {
    const view = render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));

    const row = view.container.querySelector(".spec-hub-action-orchestrator-row");
    expect(row).toBeTruthy();
    expect(row?.querySelectorAll("select, button").length).toBe(3);
    expect(screen.getByRole("button", { name: "New Proposal" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Append Proposal" })).toBeTruthy();
    expect(screen.queryByText("New Proposal")).toBeNull();
    expect(screen.queryByText("Append Proposal")).toBeNull();
    expect(screen.getByTestId("engine-icon").textContent).toBe("codex");
    expect(screen.getByRole("option", { name: /Codex/ })).toBeTruthy();
  });

  it("keeps OpenCode visible in selector when engine is unavailable", async () => {
    mockDetectEngines.mockResolvedValueOnce([
      {
        engineType: "codex",
        installed: true,
        version: "1.0.0",
        binPath: "/tmp/codex",
        features: {
          streaming: true,
          reasoning: true,
          toolUse: true,
          imageInput: true,
          sessionContinuation: true,
        },
        models: [],
        error: null,
      },
      {
        engineType: "claude",
        installed: true,
        version: "1.0.0",
        binPath: "/tmp/claude",
        features: {
          streaming: true,
          reasoning: true,
          toolUse: true,
          imageInput: true,
          sessionContinuation: true,
        },
        models: [],
        error: null,
      },
      {
        engineType: "opencode",
        installed: false,
        version: null,
        binPath: null,
        features: {
          streaming: false,
          reasoning: false,
          toolUse: false,
          imageInput: false,
          sessionContinuation: false,
        },
        models: [],
        error: "not installed",
      },
    ]);

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /OpenCode/ })).toBeTruthy();
    });
    expect((screen.getByRole("option", { name: /OpenCode/ }) as HTMLOptionElement).disabled).toBe(true);
  });

  it("disables append proposal trigger when all changes are archived", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        snapshot: {
          provider: "openspec",
          supportLevel: "full",
          specRoot: { source: "default", path: "openspec" },
          environment: {
            mode: "managed",
            status: "healthy",
            checks: [],
            blockers: [],
            hints: [],
          },
          changes: [
            {
              id: "change-archived",
              status: "archived",
              updatedAt: 1,
              artifacts: {
                proposalPath: "openspec/changes/change-archived/proposal.md",
                designPath: "openspec/changes/change-archived/design.md",
                tasksPath: "openspec/changes/change-archived/tasks.md",
                verificationPath: null,
                specPaths: ["openspec/changes/change-archived/specs/spec-hub/spec.md"],
              },
              blockers: [],
              archiveBlockers: [],
            },
          ],
          blockers: [],
        },
        selectedChange: {
          id: "change-archived",
          status: "archived",
          updatedAt: 1,
          artifacts: {
            proposalPath: "openspec/changes/change-archived/proposal.md",
            designPath: "openspec/changes/change-archived/design.md",
            tasksPath: "openspec/changes/change-archived/tasks.md",
            verificationPath: null,
            specPaths: ["openspec/changes/change-archived/specs/spec-hub/spec.md"],
          },
          blockers: [],
          archiveBlockers: [],
        },
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    expect((screen.getByRole("button", { name: "Append Proposal" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables append proposal trigger when selected change is archived", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        snapshot: {
          provider: "openspec",
          supportLevel: "full",
          specRoot: { source: "default", path: "openspec" },
          environment: {
            mode: "managed",
            status: "healthy",
            checks: [],
            blockers: [],
            hints: [],
          },
          changes: [
            {
              id: "change-ready",
              status: "ready",
              updatedAt: 1,
              artifacts: {
                proposalPath: "openspec/changes/change-ready/proposal.md",
                designPath: "openspec/changes/change-ready/design.md",
                tasksPath: "openspec/changes/change-ready/tasks.md",
                verificationPath: null,
                specPaths: ["openspec/changes/change-ready/specs/spec-hub/spec.md"],
              },
              blockers: [],
              archiveBlockers: [],
            },
            {
              id: "change-archived",
              status: "archived",
              updatedAt: 2,
              artifacts: {
                proposalPath: "openspec/changes/change-archived/proposal.md",
                designPath: "openspec/changes/change-archived/design.md",
                tasksPath: "openspec/changes/change-archived/tasks.md",
                verificationPath: null,
                specPaths: ["openspec/changes/change-archived/specs/spec-hub/spec.md"],
              },
              blockers: [],
              archiveBlockers: [],
            },
          ],
          blockers: [],
        },
        selectedChange: {
          id: "change-archived",
          status: "archived",
          updatedAt: 2,
          artifacts: {
            proposalPath: "openspec/changes/change-archived/proposal.md",
            designPath: "openspec/changes/change-archived/design.md",
            tasksPath: "openspec/changes/change-archived/tasks.md",
            verificationPath: null,
            specPaths: ["openspec/changes/change-archived/specs/spec-hub/spec.md"],
          },
          blockers: [],
          archiveBlockers: [],
        },
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    expect((screen.getByRole("button", { name: "Append Proposal" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("hides archived changes from append proposal target select", async () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        snapshot: {
          provider: "openspec",
          supportLevel: "full",
          specRoot: { source: "default", path: "openspec" },
          environment: {
            mode: "managed",
            status: "healthy",
            checks: [],
            blockers: [],
            hints: [],
          },
          changes: [
            {
              id: "change-ready-a",
              status: "ready",
              updatedAt: 1,
              artifacts: {
                proposalPath: "openspec/changes/change-ready-a/proposal.md",
                designPath: "openspec/changes/change-ready-a/design.md",
                tasksPath: "openspec/changes/change-ready-a/tasks.md",
                verificationPath: null,
                specPaths: ["openspec/changes/change-ready-a/specs/spec-hub/spec.md"],
              },
              blockers: [],
              archiveBlockers: [],
            },
            {
              id: "change-archived",
              status: "archived",
              updatedAt: 2,
              artifacts: {
                proposalPath: "openspec/changes/change-archived/proposal.md",
                designPath: "openspec/changes/change-archived/design.md",
                tasksPath: "openspec/changes/change-archived/tasks.md",
                verificationPath: null,
                specPaths: ["openspec/changes/change-archived/specs/spec-hub/spec.md"],
              },
              blockers: [],
              archiveBlockers: [],
            },
            {
              id: "change-ready-b",
              status: "ready",
              updatedAt: 3,
              artifacts: {
                proposalPath: "openspec/changes/change-ready-b/proposal.md",
                designPath: "openspec/changes/change-ready-b/design.md",
                tasksPath: "openspec/changes/change-ready-b/tasks.md",
                verificationPath: null,
                specPaths: ["openspec/changes/change-ready-b/specs/spec-hub/spec.md"],
              },
              blockers: [],
              archiveBlockers: [],
            },
          ],
          blockers: [],
        },
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Append Proposal" }));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "change-ready-a" })).toBeTruthy();
    });
    expect(screen.getByRole("option", { name: "change-ready-b" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "change-archived" })).toBeNull();
  });

  it("blocks proposal submit when content and images are both empty", () => {
    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    fireEvent.click(screen.getByRole("button", { name: "New Proposal" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit Create" }));

    expect(screen.getByText("Enter proposal content or attach at least one image.")).toBeTruthy();
  });

  it("attaches proposal images and forwards them to proposal execution", async () => {
    mockPickImageFiles.mockResolvedValueOnce(["/tmp/mock.png"]);
    mockEngineSendMessageSync.mockResolvedValueOnce({
      engine: "codex",
      text: JSON.stringify({
        summary: "proposal updated",
        change_id: "change-1",
      }),
    });

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    fireEvent.click(screen.getByRole("button", { name: "New Proposal" }));
    fireEvent.click(screen.getByRole("button", { name: "Attach image" }));

    await waitFor(() => {
      expect(screen.getByText("mock.png")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit Create" }));

    await waitFor(() => {
      expect(mockEngineSendMessageSync).toHaveBeenCalledWith(
        "ws-1",
        expect.objectContaining({
          images: ["/tmp/mock.png"],
          accessMode: "full-access",
        }),
      );
    });

    const lastCall = mockEngineSendMessageSync.mock.calls[mockEngineSendMessageSync.mock.calls.length - 1];
    const prompt = lastCall?.[1]?.text ?? "";
    expect(prompt).toContain("1 image attachment(s) are included");
  });

  it("shows validation error for unsupported proposal attachment", async () => {
    mockPickImageFiles.mockResolvedValueOnce(["/tmp/not-image.txt"]);

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    fireEvent.click(screen.getByRole("button", { name: "New Proposal" }));
    fireEvent.click(screen.getByRole("button", { name: "Attach image" }));

    await waitFor(() => {
      expect(screen.getByText("Unsupported image format. Use png/jpg/jpeg/gif/webp/bmp/tiff.")).toBeTruthy();
    });
  });

  it("renders apply execution feedback summary", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        applyExecution: {
          status: "success",
          phase: "finalize",
          executor: "codex",
          startedAt: Date.UTC(2026, 1, 25, 2, 0, 0),
          finishedAt: Date.UTC(2026, 1, 25, 2, 1, 0),
          instructionsOutput: "instructions",
          executionOutput: "done",
          summary: "Execution finished.",
          changedFiles: ["src/a.ts"],
          tests: ["vitest run src/features/spec"],
          checks: ["npm run typecheck"],
          completedTaskIndices: [0],
          noChanges: false,
          error: null,
          logs: ["phase log"],
        },
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    expect(screen.getByText("Apply Execution Feedback")).toBeTruthy();
    expect(screen.getByText("Execution finished.")).toBeTruthy();
    expect(screen.getByText((text) => text.includes("Changed files: 1"))).toBeTruthy();
    expect(screen.getByText((text) => text.includes("Tests: 1"))).toBeTruthy();
    expect(screen.getByText((text) => text.includes("Checks: 1"))).toBeTruthy();
    expect(screen.getByText((text) => text.includes("Auto-completed tasks: 1"))).toBeTruthy();
    expect(screen.getByText("src/a.ts")).toBeTruthy();
    expect(screen.getByText("vitest run src/features/spec")).toBeTruthy();
    expect(screen.getByText("npm run typecheck")).toBeTruthy();
  });

  it("supports collapsing and closing apply execution floating panel", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        applyExecution: {
          status: "running",
          phase: "execution",
          executor: "claude",
          startedAt: Date.UTC(2026, 1, 25, 2, 0, 0),
          finishedAt: null,
          instructionsOutput: "",
          executionOutput: "log output",
          summary: "Execution in progress.",
          changedFiles: [],
          tests: [],
          checks: [],
          completedTaskIndices: [],
          noChanges: false,
          error: null,
          logs: ["running log"],
        },
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    expect(screen.getByText("Apply Execution Feedback")).toBeTruthy();
    expect(screen.getByText("Execution in progress.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Collapse feedback panel" }));
    expect(screen.queryByText("Execution in progress.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Expand feedback panel" }));
    expect(screen.getByText("Execution in progress.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close feedback panel" }));
    expect(screen.queryByText("Apply Execution Feedback")).toBeNull();
  });

  it("keeps floating feedback visible after workspace switch", () => {
    let currentState = createUseSpecHubState("No strict verify evidence recorded", {
      applyExecution: {
        status: "running",
        phase: "execution",
        executor: "claude",
        startedAt: Date.UTC(2026, 1, 25, 2, 0, 0),
        finishedAt: null,
        instructionsOutput: "",
        executionOutput: "log output",
        summary: "Execution in progress.",
        changedFiles: [],
        tests: [],
        checks: [],
        completedTaskIndices: [],
        noChanges: false,
        error: null,
        logs: ["running log"],
      },
    }) as ReturnType<typeof useSpecHub>;

    mockUseSpecHub.mockImplementation(() => currentState);

    const view = render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    expect(screen.getByText("Apply Execution Feedback")).toBeTruthy();
    expect(screen.getByText("Execution in progress.")).toBeTruthy();

    currentState = createUseSpecHubState("No strict verify evidence recorded", {
      selectedChange: null,
      actions: [],
      applyExecution: {
        status: "idle",
        phase: "idle",
        executor: null,
        startedAt: null,
        finishedAt: null,
        instructionsOutput: "",
        executionOutput: "",
        summary: "",
        changedFiles: [],
        tests: [],
        checks: [],
        completedTaskIndices: [],
        noChanges: false,
        error: null,
        logs: [],
      },
    }) as ReturnType<typeof useSpecHub>;

    view.rerender(
      <SpecHub
        workspaceId="ws-2"
        workspaceName="Workspace 2"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    expect(screen.getByText("Apply Execution Feedback")).toBeTruthy();
    expect(screen.getByText("Execution in progress.")).toBeTruthy();
  });

  it("renders apply failure hint", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        applyExecution: {
          status: "failed",
          phase: "execution",
          executor: "claude",
          startedAt: Date.UTC(2026, 1, 25, 2, 0, 0),
          finishedAt: Date.UTC(2026, 1, 25, 2, 0, 20),
          instructionsOutput: "instructions",
          executionOutput: "",
          summary: "",
          changedFiles: [],
          tests: [],
          checks: [],
          completedTaskIndices: [],
          noChanges: true,
          error: "Execution failed unexpectedly.",
          logs: [],
        },
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    expect(screen.getByText("Execution failed unexpectedly.")).toBeTruthy();
  });

  it("renders apply no-change hint on successful execution", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        applyExecution: {
          status: "success",
          phase: "finalize",
          executor: "claude",
          startedAt: Date.UTC(2026, 1, 25, 2, 0, 0),
          finishedAt: Date.UTC(2026, 1, 25, 2, 0, 20),
          instructionsOutput: "instructions",
          executionOutput: "",
          summary: "No updates required.",
          changedFiles: [],
          tests: [],
          checks: [],
          completedTaskIndices: [],
          noChanges: true,
          error: null,
          logs: [],
        },
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    expect(screen.getByText("Execution finished without code changes.")).toBeTruthy();
  });

  it("groups archived changes by date prefix and keeps fallback bucket", () => {
    const selectChange = vi.fn();
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        snapshot: {
          provider: "openspec",
          supportLevel: "full",
          specRoot: { source: "default", path: "openspec" },
          environment: {
            mode: "managed",
            status: "healthy",
            checks: [],
            blockers: [],
            hints: [],
          },
          changes: [
            {
              id: "2026-02-26-alpha-fix",
              status: "archived",
              updatedAt: 3,
              artifacts: {
                proposalPath: "openspec/changes/archive/2026-02-26-alpha-fix/proposal.md",
                designPath: "openspec/changes/archive/2026-02-26-alpha-fix/design.md",
                tasksPath: "openspec/changes/archive/2026-02-26-alpha-fix/tasks.md",
                verificationPath: null,
                specPaths: [],
              },
              blockers: [],
              archiveBlockers: [],
            },
            {
              id: "legacy-change",
              status: "archived",
              updatedAt: 2,
              artifacts: {
                proposalPath: "openspec/changes/archive/legacy-change/proposal.md",
                designPath: "openspec/changes/archive/legacy-change/design.md",
                tasksPath: "openspec/changes/archive/legacy-change/tasks.md",
                verificationPath: null,
                specPaths: [],
              },
              blockers: [],
              archiveBlockers: [],
            },
            {
              id: "2026-02-26-beta-fix",
              status: "archived",
              updatedAt: 1,
              artifacts: {
                proposalPath: "openspec/changes/archive/2026-02-26-beta-fix/proposal.md",
                designPath: "openspec/changes/archive/2026-02-26-beta-fix/design.md",
                tasksPath: "openspec/changes/archive/2026-02-26-beta-fix/tasks.md",
                verificationPath: null,
                specPaths: [],
              },
              blockers: [],
              archiveBlockers: [],
            },
          ],
          blockers: [],
        },
        selectedChange: null,
        selectChange,
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Archived" }));

    expect(getChangeGroupToggle(/2026-02-26/i)).toBeTruthy();
    expect(getChangeGroupToggle(/Other/i)).toBeTruthy();
    expect(screen.getByText("2026-02-26-alpha-fix")).toBeTruthy();
    expect(screen.getByText("2026-02-26-beta-fix")).toBeTruthy();
    expect(screen.getByText("legacy-change")).toBeTruthy();

    fireEvent.click(screen.getByText("legacy-change"));
    expect(selectChange).toHaveBeenCalledWith("legacy-change");
  });

  it("toggles archived date group collapse and expand", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        snapshot: {
          provider: "openspec",
          supportLevel: "full",
          specRoot: { source: "default", path: "openspec" },
          environment: {
            mode: "managed",
            status: "healthy",
            checks: [],
            blockers: [],
            hints: [],
          },
          changes: [
            {
              id: "2026-02-26-collapse-a",
              status: "archived",
              updatedAt: 2,
              artifacts: {
                proposalPath: "openspec/changes/archive/2026-02-26-collapse-a/proposal.md",
                designPath: "openspec/changes/archive/2026-02-26-collapse-a/design.md",
                tasksPath: "openspec/changes/archive/2026-02-26-collapse-a/tasks.md",
                verificationPath: null,
                specPaths: [],
              },
              blockers: [],
              archiveBlockers: [],
            },
            {
              id: "2026-02-26-collapse-b",
              status: "archived",
              updatedAt: 1,
              artifacts: {
                proposalPath: "openspec/changes/archive/2026-02-26-collapse-b/proposal.md",
                designPath: "openspec/changes/archive/2026-02-26-collapse-b/design.md",
                tasksPath: "openspec/changes/archive/2026-02-26-collapse-b/tasks.md",
                verificationPath: null,
                specPaths: [],
              },
              blockers: [],
              archiveBlockers: [],
            },
          ],
          blockers: [],
        },
        selectedChange: null,
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Archived" }));

    const groupToggle = getChangeGroupToggle(/2026-02-26/i);
    expect(groupToggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("2026-02-26-collapse-a")).toBeTruthy();

    fireEvent.click(groupToggle);
    expect(groupToggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("2026-02-26-collapse-a")).toBeNull();

    fireEvent.click(groupToggle);
    expect(groupToggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("2026-02-26-collapse-a")).toBeTruthy();
  });

  it("groups date-prefixed changes in all view with fallback bucket", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        snapshot: {
          provider: "openspec",
          supportLevel: "full",
          specRoot: { source: "default", path: "openspec" },
          environment: {
            mode: "managed",
            status: "healthy",
            checks: [],
            blockers: [],
            hints: [],
          },
          changes: [
            {
              id: "2026-02-26-active-a",
              status: "ready",
              updatedAt: 3,
              artifacts: {
                proposalPath: "openspec/changes/2026-02-26-active-a/proposal.md",
                designPath: "openspec/changes/2026-02-26-active-a/design.md",
                tasksPath: "openspec/changes/2026-02-26-active-a/tasks.md",
                verificationPath: null,
                specPaths: [],
              },
              blockers: [],
              archiveBlockers: [],
            },
            {
              id: "2026-02-26-archived-b",
              status: "archived",
              updatedAt: 2,
              artifacts: {
                proposalPath: "openspec/changes/archive/2026-02-26-archived-b/proposal.md",
                designPath: "openspec/changes/archive/2026-02-26-archived-b/design.md",
                tasksPath: "openspec/changes/archive/2026-02-26-archived-b/tasks.md",
                verificationPath: null,
                specPaths: [],
              },
              blockers: [],
              archiveBlockers: [],
            },
            {
              id: "legacy-active-change",
              status: "implementing",
              updatedAt: 1,
              artifacts: {
                proposalPath: "openspec/changes/legacy-active-change/proposal.md",
                designPath: "openspec/changes/legacy-active-change/design.md",
                tasksPath: "openspec/changes/legacy-active-change/tasks.md",
                verificationPath: null,
                specPaths: [],
              },
              blockers: [],
              archiveBlockers: [],
            },
          ],
          blockers: [],
        },
      }) as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    expect(getChangeGroupToggle(/2026-02-26/i)).toBeTruthy();
    expect(getChangeGroupToggle(/Other/i)).toBeTruthy();
    expect(screen.getByText("2026-02-26-active-a")).toBeTruthy();
    expect(screen.getByText("2026-02-26-archived-b")).toBeTruthy();
    expect(screen.getByText("legacy-active-change")).toBeTruthy();
  });

  it("shows backlog empty state when no deferred changes exist", () => {
    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Backlog" }));

    expect(screen.getByText("No backlog changes")).toBeTruthy();
    expect(screen.getByText("Move deferred proposals here from the change list.")).toBeTruthy();
  });

  it("keeps backlog members out of active view and marks them in backlog view", () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        snapshot: {
          provider: "openspec",
          supportLevel: "full",
          specRoot: { source: "default", path: "openspec" },
          environment: {
            mode: "managed",
            status: "healthy",
            checks: [],
            blockers: [],
            hints: [],
          },
          changes: [
            {
              id: "change-1",
              status: "ready",
              updatedAt: 2,
              artifacts: {
                proposalPath: "openspec/changes/change-1/proposal.md",
                designPath: "openspec/changes/change-1/design.md",
                tasksPath: "openspec/changes/change-1/tasks.md",
                verificationPath: null,
                specPaths: [],
              },
              blockers: [],
              archiveBlockers: [],
            },
            {
              id: "change-2",
              status: "implementing",
              updatedAt: 1,
              artifacts: {
                proposalPath: "openspec/changes/change-2/proposal.md",
                designPath: "openspec/changes/change-2/design.md",
                tasksPath: "openspec/changes/change-2/tasks.md",
                verificationPath: null,
                specPaths: [],
              },
              blockers: [],
              archiveBlockers: [],
            },
          ],
          blockers: [],
        },
        selectedChange: {
          id: "change-1",
          status: "ready",
          updatedAt: 2,
          artifacts: {
            proposalPath: "openspec/changes/change-1/proposal.md",
            designPath: "openspec/changes/change-1/design.md",
            tasksPath: "openspec/changes/change-1/tasks.md",
            verificationPath: null,
            specPaths: [],
          },
          blockers: [],
          archiveBlockers: [],
        },
        backlogChangeIds: ["change-2"],
      }),
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    const backlogRow = document.querySelector(".spec-hub-change-item.is-backlog");
    expect(backlogRow?.textContent).toContain("change-2");

    fireEvent.click(screen.getByRole("button", { name: "Active" }));
    expect(screen.getByText("change-1")).toBeTruthy();
    expect(screen.queryByText("change-2")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Backlog" }));
    expect(screen.getByText("change-2")).toBeTruthy();
    expect(screen.getAllByText("Backlog").length).toBeGreaterThan(0);
  });

  it("moves a change into backlog from the context menu", () => {
    const moveChangeToBacklog = vi.fn();
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        moveChangeToBacklog,
      }),
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: /change-1/i }), {
      clientX: 120,
      clientY: 140,
    });

    fireEvent.click(screen.getByRole("menuitem", { name: "Move to backlog" }));

    expect(moveChangeToBacklog).toHaveBeenCalledWith("change-1");
  });

  it("removes a change from backlog from the keyboard context-menu flow", () => {
    const removeChangeFromBacklog = vi.fn();
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        backlogChangeIds: ["change-1"],
        removeChangeFromBacklog,
      }),
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace"
        files={[]}
        directories={[]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: /change-1/i }), {
      key: "F10",
      shiftKey: true,
    });

    fireEvent.click(screen.getByRole("menuitem", { name: "Remove from backlog" }));

    expect(removeChangeFromBacklog).toHaveBeenCalledWith("change-1");
  });

});
