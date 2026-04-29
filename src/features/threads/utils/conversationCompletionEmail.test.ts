import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import { buildConversationCompletionEmail } from "./conversationCompletionEmail";

const baseMetadata = {
  workspaceId: "ws-1",
  workspaceName: "Moss Workspace",
  workspacePath: "/repo/mossx",
  threadId: "thread-1",
  threadName: "Email proposal",
  turnId: "turn-1",
  engine: "codex" as const,
};

describe("buildConversationCompletionEmail", () => {
  it("builds plain text email from the final user and assistant messages", () => {
    const items: ConversationItem[] = [
      { id: "u1", kind: "message", role: "user", text: "Please implement it." },
      { id: "a1", kind: "message", role: "assistant", text: "Done. I changed the files." },
    ];

    const result = buildConversationCompletionEmail(items, baseMetadata);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.subject).toBe("Moss conversation completed - Moss Workspace");
    expect(result.request.textBody).toContain("Workspace: Moss Workspace");
    expect(result.request.textBody).toContain("Thread: Email proposal");
    expect(result.request.textBody).toContain("User\nPlease implement it.");
    expect(result.request.textBody).toContain("Assistant\nDone. I changed the files.");
    expect(result.activityCount).toBe(0);
  });

  it("summarizes file change and command execution tool cards", () => {
    const items: ConversationItem[] = [
      { id: "u1", kind: "message", role: "user", text: "Add tests." },
      {
        id: "tool-1",
        kind: "tool",
        toolType: "fileChange",
        title: "File changes",
        detail: "Updated source",
        status: "completed",
        changes: [
          { path: "src/a.ts", kind: "modified" },
          { path: "src/b.ts", kind: "added" },
        ],
      },
      {
        id: "tool-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "npm test",
        detail: "vitest",
        status: "completed",
        output: "PASS src/a.test.ts",
      },
      { id: "a1", kind: "message", role: "assistant", text: "Tests are passing." },
    ];

    const result = buildConversationCompletionEmail(items, baseMetadata);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.textBody).toContain("Activity");
    expect(result.request.textBody).toContain("Tool: File changes");
    expect(result.request.textBody).toContain("- src/a.ts");
    expect(result.request.textBody).toContain("- src/b.ts");
    expect(result.request.textBody).toContain("Tool: npm test");
    expect(result.request.textBody).toContain("PASS src/a.test.ts");
    expect(result.activityCount).toBe(2);
  });

  it("summarizes diff, review, and generated image cards", () => {
    const items: ConversationItem[] = [
      { id: "u1", kind: "message", role: "user", text: "Review and draw." },
      {
        id: "d1",
        kind: "diff",
        title: "src/app.ts",
        diff: "+const value = true;",
        status: "completed",
      },
      {
        id: "r1",
        kind: "review",
        state: "completed",
        text: "No blocking issues.",
      },
      {
        id: "g1",
        kind: "generatedImage",
        status: "completed",
        promptText: "wireframe",
        images: [{ src: "image://one", localPath: "/tmp/one.png" }],
      },
      { id: "a1", kind: "message", role: "assistant", text: "Review done." },
    ];

    const result = buildConversationCompletionEmail(items, baseMetadata);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.textBody).toContain("Diff: src/app.ts");
    expect(result.request.textBody).toContain("Review: completed");
    expect(result.request.textBody).toContain("Generated image: completed");
    expect(result.request.textBody).toContain("/tmp/one.png");
  });

  it("keeps Windows workspace paths as display metadata", () => {
    const result = buildConversationCompletionEmail(
      [
        { id: "u1", kind: "message", role: "user", text: "Ship it." },
        { id: "a1", kind: "message", role: "assistant", text: "Shipped." },
      ],
      {
        ...baseMetadata,
        workspacePath: "C:\\Users\\Chen\\project",
      },
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.request.textBody).toContain("Path: C:\\Users\\Chen\\project");
  });

  it("skips when the visible conversation has no assistant answer", () => {
    const result = buildConversationCompletionEmail(
      [{ id: "u1", kind: "message", role: "user", text: "Ping" }],
      baseMetadata,
    );

    expect(result).toEqual({
      status: "skipped",
      reason: "missing_assistant_message",
    });
  });
});
