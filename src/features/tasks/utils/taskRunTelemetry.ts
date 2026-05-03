import type { ThreadCompletionTracker } from "../../../app-shell-parts/utils";
import type { ConversationItem, EngineType } from "../../../types";
import type { TaskRunArtifact, TaskRunRecord, TaskRunStatus } from "../types";
import { isTaskRunActive } from "./taskRunStorage";

export type TaskRunTelemetryInput = {
  run: TaskRunRecord;
  threadStatus?: ThreadCompletionTracker | null;
  items?: ConversationItem[];
  now?: number;
};

function compactText(value: string, maxLength = 280): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  if (compacted.length <= maxLength) {
    return compacted;
  }
  return `${compacted.slice(0, Math.max(0, maxLength - 1))}...`;
}

function extractLatestReadableOutput(items: ConversationItem[] | undefined): string | null {
  if (!items?.length) {
    return null;
  }
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item) {
      continue;
    }
    if (item.kind === "message" && item.role === "assistant" && item.text.trim()) {
      return compactText(item.text);
    }
    if (item.kind === "tool" && item.output?.trim()) {
      return compactText(item.output);
    }
    if (item.kind === "review" && item.text.trim()) {
      return compactText(item.text);
    }
  }
  return null;
}

function extractArtifacts(items: ConversationItem[] | undefined): TaskRunArtifact[] {
  if (!items?.length) {
    return [];
  }
  const artifacts: TaskRunArtifact[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item.kind !== "tool" || !Array.isArray(item.changes)) {
      continue;
    }
    for (const change of item.changes) {
      if (!change?.path || seen.has(change.path)) {
        continue;
      }
      seen.add(change.path);
      artifacts.push({
        kind: "file",
        label: change.path,
        ref: change.path,
      });
    }
  }
  return artifacts;
}

function inferCurrentStep(items: ConversationItem[] | undefined): string | null {
  const latestTool = [...(items ?? [])]
    .reverse()
    .find((item) => item.kind === "tool" && (item.detail?.trim() || item.output?.trim()));
  if (!latestTool || latestTool.kind !== "tool") {
    return null;
  }
  return compactText(latestTool.detail?.trim() || latestTool.output?.trim() || "", 120);
}

export function inferTaskRunEngine(threadId: string | null | undefined): EngineType | null {
  if (!threadId) {
    return null;
  }
  if (threadId.startsWith("claude:") || threadId.startsWith("claude-pending-")) {
    return "claude";
  }
  if (threadId.startsWith("codex:") || threadId.startsWith("codex-pending-")) {
    return "codex";
  }
  if (threadId.startsWith("gemini:") || threadId.startsWith("gemini-pending-")) {
    return "gemini";
  }
  if (threadId.startsWith("opencode:") || threadId.startsWith("opencode-pending-")) {
    return "opencode";
  }
  return "claude";
}

export function normalizeTaskRunTelemetry({
  run,
  threadStatus,
  items,
  now = Date.now(),
}: TaskRunTelemetryInput): TaskRunRecord {
  const latestOutputSummary = extractLatestReadableOutput(items) ?? run.latestOutputSummary ?? null;
  const currentStep = inferCurrentStep(items) ?? run.currentStep ?? null;
  const artifacts = extractArtifacts(items);
  const nextArtifacts = artifacts.length > 0 ? artifacts : run.artifacts;
  let status: TaskRunStatus = run.status;
  if (threadStatus?.isProcessing && isTaskRunActive(run.status)) {
    status = run.planSnapshot || currentStep ? "running" : "planning";
  }
  if (!threadStatus?.isProcessing && (run.status === "running" || run.status === "planning")) {
    status = "completed";
  }
  return {
    ...run,
    status,
    currentStep,
    latestOutputSummary,
    artifacts: nextArtifacts,
    availableRecoveryActions:
      status === "failed" || status === "blocked"
        ? ["open_conversation", "retry", "resume"]
        : status === "completed" || status === "canceled"
          ? ["open_conversation", "fork_new_run"]
          : ["open_conversation", "cancel"],
    updatedAt: now,
    finishedAt:
      status === "completed" || status === "failed" || status === "canceled"
        ? run.finishedAt ?? now
        : null,
  };
}
