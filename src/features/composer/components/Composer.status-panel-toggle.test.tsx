/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EngineType } from "../../../types";
import type { ReviewPromptState } from "../../threads/hooks/useReviewPrompt";
import type { ComposerSendReadiness } from "../utils/composerSendReadiness";
import { Composer } from "./Composer";

afterEach(() => {
  cleanup();
});

vi.mock("../../../services/dragDrop", () => ({
  subscribeWindowDragDrop: vi.fn(() => () => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `tauri://${path}`,
  invoke: vi.fn(async () => null),
}));

vi.mock("../../engine/components/EngineSelector", () => ({
  EngineSelector: () => null,
}));

vi.mock("../../opencode/components/OpenCodeControlPanel", () => ({
  OpenCodeControlPanel: () => null,
}));

vi.mock("../../status-panel/components/StatusPanel", () => ({
  StatusPanel: () => <div data-testid="status-panel" />,
}));

vi.mock("./ChatInputBox/ChatInputBoxAdapter", () => ({
  ChatInputBoxAdapter: ({
    sendReadiness,
    showStatusPanelToggle,
  }: {
    sendReadiness?: ComposerSendReadiness;
    showStatusPanelToggle?: boolean;
  }) => (
    <div
      data-testid="chat-input-box-adapter"
      data-disabled-reason={sendReadiness?.readiness.disabledReason ?? ""}
      data-show-status-panel-toggle={String(showStatusPanelToggle)}
    />
  ),
}));

function ComposerHarness({
  selectedEngine,
  runtimeLifecycleState,
  showStatusPanelToggleOverride,
  onClearCodeAnnotations,
}: {
  selectedEngine: EngineType;
  runtimeLifecycleState?: "recovering";
  showStatusPanelToggleOverride?: boolean;
  onClearCodeAnnotations?: () => void;
}) {
  const reviewPrompt: NonNullable<ReviewPromptState> = {
    workspace: {
      id: "ws-1",
      name: "Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: {
        sidebarCollapsed: false,
      },
    },
    threadIdSnapshot: "thread-1",
    step: "preset",
    branches: [],
    commits: [],
    isLoadingBranches: false,
    isLoadingCommits: false,
    selectedBranch: "",
    selectedCommitSha: "",
    selectedCommitTitle: "",
    customInstructions: "",
    error: null,
    isSubmitting: false,
  };

  return (
    <Composer
      onSend={() => {}}
      onQueue={() => {}}
      onStop={() => {}}
      canStop={false}
      isProcessing={false}
      steerEnabled={false}
      collaborationModes={[]}
      collaborationModesEnabled={true}
      selectedCollaborationModeId={null}
      onSelectCollaborationMode={() => {}}
      selectedEngine={selectedEngine}
      models={[]}
      selectedModelId={null}
      onSelectModel={() => {}}
      reasoningOptions={[]}
      selectedEffort={null}
      onSelectEffort={() => {}}
      reasoningSupported={false}
      accessMode="current"
      onSelectAccessMode={() => {}}
      skills={[]}
      prompts={[]}
      commands={[]}
      files={[]}
      draftText=""
      onDraftChange={() => {}}
      dictationEnabled={false}
      activeWorkspaceId="ws-1"
      activeThreadId="thread-1"
      runtimeLifecycleState={runtimeLifecycleState ?? null}
      showStatusPanelToggleOverride={showStatusPanelToggleOverride}
      reviewPrompt={reviewPrompt}
      onReviewPromptClose={() => {}}
      onReviewPromptShowPreset={() => {}}
      onReviewPromptChoosePreset={() => {}}
      highlightedPresetIndex={0}
      onReviewPromptHighlightPreset={() => {}}
      highlightedBranchIndex={0}
      onReviewPromptHighlightBranch={() => {}}
      highlightedCommitIndex={0}
      onReviewPromptHighlightCommit={() => {}}
      onReviewPromptSelectBranch={() => {}}
      onReviewPromptSelectBranchAtIndex={() => {}}
      onReviewPromptConfirmBranch={async () => {}}
      onReviewPromptSelectCommit={() => {}}
      onReviewPromptSelectCommitAtIndex={() => {}}
      onReviewPromptConfirmCommit={async () => {}}
      onReviewPromptUpdateCustomInstructions={() => {}}
      onReviewPromptConfirmCustom={async () => {}}
      onClearCodeAnnotations={onClearCodeAnnotations}
    />
  );
}

describe("Composer status panel toggle visibility", () => {
  it("shows status panel toggle on claude engine", () => {
    render(<ComposerHarness selectedEngine="claude" />);
    expect(screen.queryByTestId("status-panel")).toBeNull();
    expect(
      screen
        .getByTestId("chat-input-box-adapter")
        .getAttribute("data-show-status-panel-toggle"),
    ).toBe("true");
  });

  it("shows status panel toggle on codex engine", () => {
    render(<ComposerHarness selectedEngine="codex" />);
    expect(screen.queryByTestId("status-panel")).toBeNull();
    expect(
      screen
        .getByTestId("chat-input-box-adapter")
        .getAttribute("data-show-status-panel-toggle"),
    ).toBe("true");
  });

  it("projects runtime lifecycle into send readiness disabled reason", () => {
    render(<ComposerHarness selectedEngine="codex" runtimeLifecycleState="recovering" />);
    expect(
      screen
        .getByTestId("chat-input-box-adapter")
        .getAttribute("data-disabled-reason"),
    ).toBe("runtime-recovering");
  });

  it("shows status panel toggle on gemini engine", () => {
    render(<ComposerHarness selectedEngine="gemini" />);
    expect(screen.queryByTestId("status-panel")).toBeNull();
    expect(
      screen
        .getByTestId("chat-input-box-adapter")
        .getAttribute("data-show-status-panel-toggle"),
    ).toBe("true");
  });

  it("hides status panel toggle when explicitly overridden off", () => {
    render(
      <ComposerHarness
        selectedEngine="gemini"
        showStatusPanelToggleOverride={false}
      />,
    );
    expect(screen.queryByTestId("status-panel")).toBeNull();
    expect(
      screen
        .getByTestId("chat-input-box-adapter")
        .getAttribute("data-show-status-panel-toggle"),
    ).toBe("false");
  });

  it("renders review preset prompt in ChatInputBoxAdapter flow", () => {
    const { container } = render(<ComposerHarness selectedEngine="codex" />);
    expect(container.querySelector(".review-inline")).toBeTruthy();
  });

  it("does not reset session context when only clear callback identity changes", () => {
    const firstClearCodeAnnotations = vi.fn();
    const secondClearCodeAnnotations = vi.fn();
    const view = render(
      <ComposerHarness
        selectedEngine="codex"
        onClearCodeAnnotations={firstClearCodeAnnotations}
      />,
    );

    expect(firstClearCodeAnnotations).toHaveBeenCalledTimes(1);

    view.rerender(
      <ComposerHarness
        selectedEngine="codex"
        onClearCodeAnnotations={secondClearCodeAnnotations}
      />,
    );

    expect(secondClearCodeAnnotations).not.toHaveBeenCalled();
  });
});
