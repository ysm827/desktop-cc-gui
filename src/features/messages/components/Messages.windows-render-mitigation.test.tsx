// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import type { ConversationState } from "../../threads/contracts/conversationCurtainContracts";

const mocks = vi.hoisted(() => ({
  isWindowsPlatform: vi.fn(),
}));

vi.mock("../../../utils/platform", () => ({
  isWindowsPlatform: mocks.isWindowsPlatform,
}));

import { Messages } from "./Messages";

function renderMessages(options?: {
  isThinking?: boolean;
  activeEngine?: "claude" | "codex" | "gemini" | "opencode";
  conversationState?: ConversationState | null;
}) {
  const items: ConversationItem[] = [
    {
      id: "user-msg",
      kind: "message",
      role: "user",
      text: "继续",
    },
    {
      id: "assistant-msg",
      kind: "message",
      role: "assistant",
      text: "正在处理",
    },
  ];
  return render(
    <Messages
      items={items}
      threadId="thread-1"
      workspaceId="ws-1"
      isThinking={options?.isThinking ?? true}
      activeEngine={options?.activeEngine ?? "claude"}
      conversationState={options?.conversationState ?? null}
      openTargets={[]}
      selectedOpenAppId=""
    />,
  );
}

describe("Messages windows render mitigation", () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  beforeEach(() => {
    mocks.isWindowsPlatform.mockReset();
    mocks.isWindowsPlatform.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  it("adds mitigation class for Windows Claude live conversations", () => {
    mocks.isWindowsPlatform.mockReturnValue(true);

    const { container } = renderMessages();

    expect(container.firstElementChild?.className).toContain("windows-claude-processing");
  });

  it("does not add mitigation class outside Windows desktop", () => {
    const { container } = renderMessages();

    expect(container.firstElementChild?.className).not.toContain("windows-claude-processing");
  });

  it("uses normalized conversation state when prop thinking flag is stale", () => {
    mocks.isWindowsPlatform.mockReturnValue(true);

    const conversationState: ConversationState = {
      items: [],
      plan: null,
      userInputQueue: [],
      meta: {
        workspaceId: "ws-1",
        threadId: "thread-1",
        engine: "claude",
        activeTurnId: null,
        isThinking: true,
        heartbeatPulse: null,
        historyRestoredAtMs: null,
      },
    };

    const { container } = renderMessages({
      isThinking: false,
      conversationState,
    });

    expect(container.firstElementChild?.className).toContain("windows-claude-processing");
  });

  it("does not add mitigation class for non-Claude engines on Windows", () => {
    mocks.isWindowsPlatform.mockReturnValue(true);

    const { container } = renderMessages({
      activeEngine: "codex",
    });

    expect(container.firstElementChild?.className).not.toContain("windows-claude-processing");
  });
});
