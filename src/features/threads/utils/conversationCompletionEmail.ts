import type {
  ConversationItem,
  EngineType,
  SendConversationCompletionEmailRequest,
} from "../../../types";

const MAX_TEXT_SECTION_LENGTH = 12_000;
const MAX_ACTIVITY_OUTPUT_LENGTH = 1_600;
const MAX_DIFF_LENGTH = 1_600;
const MAX_ACTIVITY_ITEMS = 20;

type MessageItem = Extract<ConversationItem, { kind: "message" }>;
type ToolItem = Extract<ConversationItem, { kind: "tool" }>;
type DiffItem = Extract<ConversationItem, { kind: "diff" }>;
type ReviewItem = Extract<ConversationItem, { kind: "review" }>;
type GeneratedImageItem = Extract<ConversationItem, { kind: "generatedImage" }>;
type ExploreItem = Extract<ConversationItem, { kind: "explore" }>;

export type ConversationCompletionEmailMetadata = {
  workspaceId: string;
  workspaceName?: string | null;
  workspacePath?: string | null;
  threadId: string;
  threadName?: string | null;
  turnId: string;
  engine?: EngineType | null;
};

export type ConversationCompletionEmailBuildResult =
  | {
      status: "ready";
      request: SendConversationCompletionEmailRequest;
      userMessage: string;
      assistantMessage: string;
      activityCount: number;
    }
  | {
      status: "skipped";
      reason: "missing_user_message" | "missing_assistant_message" | "missing_metadata";
    };

function isMessageItem(item: ConversationItem): item is MessageItem {
  return item.kind === "message";
}

function nonEmptyText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 32)).trimEnd()}\n...[truncated ${value.length - maxLength} chars]`;
}

function compactLine(value: string | null | undefined): string {
  return nonEmptyText(value).replace(/\s+/g, " ");
}

function formatMetadata(metadata: ConversationCompletionEmailMetadata): string[] {
  const lines = [
    `Workspace: ${metadata.workspaceName?.trim() || metadata.workspaceId}`,
    `Thread: ${metadata.threadName?.trim() || metadata.threadId}`,
    `Turn: ${metadata.turnId}`,
  ];
  if (metadata.workspacePath?.trim()) {
    lines.push(`Path: ${metadata.workspacePath.trim()}`);
  }
  if (metadata.engine) {
    lines.push(`Engine: ${metadata.engine}`);
  }
  return lines;
}

function formatToolActivity(item: ToolItem): string | null {
  const title = compactLine(item.title) || compactLine(item.toolType) || "Tool";
  const lines = [`- Tool: ${title}`];
  const detail = compactLine(item.detail);
  if (detail) {
    lines.push(`  Detail: ${detail}`);
  }
  if (item.status) {
    lines.push(`  Status: ${item.status}`);
  }
  const changedPaths = (item.changes ?? [])
    .map((change) => compactLine(change.path))
    .filter(Boolean);
  if (changedPaths.length > 0) {
    lines.push("  Files:");
    changedPaths.forEach((path) => {
      lines.push(`    - ${path}`);
    });
  }
  const output = nonEmptyText(item.output);
  if (output) {
    lines.push(`  Output:\n${indentBlock(truncateText(output, MAX_ACTIVITY_OUTPUT_LENGTH), 4)}`);
  }
  return lines.join("\n");
}

function formatDiffActivity(item: DiffItem): string | null {
  const title = compactLine(item.title) || "Diff";
  const lines = [`- Diff: ${title}`];
  if (item.status) {
    lines.push(`  Status: ${item.status}`);
  }
  const diff = nonEmptyText(item.diff);
  if (diff) {
    lines.push(`  Summary:\n${indentBlock(truncateText(diff, MAX_DIFF_LENGTH), 4)}`);
  }
  return lines.join("\n");
}

function formatReviewActivity(item: ReviewItem): string | null {
  const text = nonEmptyText(item.text);
  if (!text) {
    return `- Review: ${item.state}`;
  }
  return `- Review: ${item.state}\n${indentBlock(truncateText(text, MAX_ACTIVITY_OUTPUT_LENGTH), 2)}`;
}

function formatGeneratedImageActivity(item: GeneratedImageItem): string | null {
  const prompt = compactLine(item.promptText);
  const imageLines = item.images
    .map((image) => compactLine(image.localPath ?? image.src))
    .filter(Boolean);
  const lines = [`- Generated image: ${item.status}`];
  if (prompt) {
    lines.push(`  Prompt: ${prompt}`);
  }
  if (imageLines.length > 0) {
    lines.push("  Images:");
    imageLines.forEach((image) => {
      lines.push(`    - ${image}`);
    });
  }
  return lines.join("\n");
}

function formatExploreActivity(item: ExploreItem): string | null {
  const title = compactLine(item.title) || "Activity";
  const lines = [`- ${title}: ${item.status}`];
  item.entries.slice(0, 8).forEach((entry) => {
    const label = compactLine(entry.label);
    const detail = compactLine(entry.detail);
    if (label && detail) {
      lines.push(`  - ${entry.kind}: ${label} - ${detail}`);
    } else if (label) {
      lines.push(`  - ${entry.kind}: ${label}`);
    }
  });
  return lines.join("\n");
}

function indentBlock(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function formatActivity(item: ConversationItem): string | null {
  if (item.kind === "tool") {
    return formatToolActivity(item);
  }
  if (item.kind === "diff") {
    return formatDiffActivity(item);
  }
  if (item.kind === "review") {
    return formatReviewActivity(item);
  }
  if (item.kind === "generatedImage") {
    return formatGeneratedImageActivity(item);
  }
  if (item.kind === "explore") {
    return formatExploreActivity(item);
  }
  return null;
}

function findFinalAssistantIndex(items: ConversationItem[]): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (
      item &&
      isMessageItem(item) &&
      item.role === "assistant" &&
      nonEmptyText(item.text)
    ) {
      return index;
    }
  }
  return -1;
}

function findUserIndexBefore(items: ConversationItem[], beforeIndex: number): number {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (
      item &&
      isMessageItem(item) &&
      item.role === "user" &&
      (nonEmptyText(item.text) || (item.images?.length ?? 0) > 0)
    ) {
      return index;
    }
  }
  return -1;
}

export function buildConversationCompletionEmail(
  items: ConversationItem[],
  metadata: ConversationCompletionEmailMetadata,
): ConversationCompletionEmailBuildResult {
  if (
    !metadata.workspaceId.trim() ||
    !metadata.threadId.trim() ||
    !metadata.turnId.trim()
  ) {
    return { status: "skipped", reason: "missing_metadata" };
  }

  const assistantIndex = findFinalAssistantIndex(items);
  if (assistantIndex < 0) {
    return { status: "skipped", reason: "missing_assistant_message" };
  }

  const userIndex = findUserIndexBefore(items, assistantIndex);
  if (userIndex < 0) {
    return { status: "skipped", reason: "missing_user_message" };
  }

  const userItem = items[userIndex] as MessageItem;
  const assistantItem = items[assistantIndex] as MessageItem;
  const userMessage = nonEmptyText(userItem.text) || "[Image-only message]";
  const assistantMessage = nonEmptyText(assistantItem.text);
  if (!assistantMessage) {
    return { status: "skipped", reason: "missing_assistant_message" };
  }

  const activitySummaries = items
    .slice(userIndex + 1)
    .map(formatActivity)
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, MAX_ACTIVITY_ITEMS);
  const subjectWorkspace = metadata.workspaceName?.trim() || metadata.workspaceId;
  const subject = `Moss conversation completed - ${subjectWorkspace}`;
  const sections = [
    "Moss conversation completed",
    "",
    ...formatMetadata(metadata),
    "",
    "User",
    truncateText(userMessage, MAX_TEXT_SECTION_LENGTH),
    "",
    "Assistant",
    truncateText(assistantMessage, MAX_TEXT_SECTION_LENGTH),
  ];

  if (activitySummaries.length > 0) {
    sections.push("", "Activity", ...activitySummaries);
  }

  return {
    status: "ready",
    request: {
      workspaceId: metadata.workspaceId,
      threadId: metadata.threadId,
      turnId: metadata.turnId,
      subject,
      textBody: sections.join("\n"),
    },
    userMessage,
    assistantMessage,
    activityCount: activitySummaries.length,
  };
}
