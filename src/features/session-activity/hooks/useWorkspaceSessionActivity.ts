import { useMemo, useRef } from "react";
import type { ConversationItem, ThreadSummary } from "../../../types";
import { buildWorkspaceSessionActivity } from "../adapters/buildWorkspaceSessionActivity";

type ThreadStatusSnapshot = {
  isProcessing?: boolean;
};

type UseWorkspaceSessionActivityOptions = {
  activeThreadId: string | null;
  threads: ThreadSummary[];
  itemsByThread: Record<string, ConversationItem[]>;
  threadParentById: Record<string, string>;
  threadStatusById: Record<string, ThreadStatusSnapshot | undefined>;
};

export function useWorkspaceSessionActivity({
  activeThreadId,
  threads,
  itemsByThread,
  threadParentById,
  threadStatusById,
}: UseWorkspaceSessionActivityOptions) {
  const eventOccurredAtRef = useRef<Record<string, number>>({});
  const eventSequenceRef = useRef(0);

  return useMemo(
    () => {
      const nextViewModel = buildWorkspaceSessionActivity({
        activeThreadId,
        threads,
        itemsByThread,
        threadParentById,
        threadStatusById,
      });

      const previousOccurredAtByEventId = eventOccurredAtRef.current;
      const nextOccurredAtByEventId: Record<string, number> = {};
      const nowBase = Date.now();
      let eventSequence = eventSequenceRef.current;

      const timeline = nextViewModel.timeline
        .map((event) => {
          const previousOccurredAt = previousOccurredAtByEventId[event.eventId];
          const occurredAt =
            typeof previousOccurredAt === "number" && previousOccurredAt > 0
              ? previousOccurredAt
              : nowBase - eventSequence++;
          nextOccurredAtByEventId[event.eventId] = occurredAt;
          if (occurredAt === event.occurredAt) {
            return event;
          }
          return {
            ...event,
            occurredAt,
          };
        })
        .sort((left, right) => right.occurredAt - left.occurredAt);

      eventOccurredAtRef.current = nextOccurredAtByEventId;
      eventSequenceRef.current = eventSequence;

      return {
        ...nextViewModel,
        timeline,
      };
    },
    [activeThreadId, itemsByThread, threadParentById, threadStatusById, threads],
  );
}
