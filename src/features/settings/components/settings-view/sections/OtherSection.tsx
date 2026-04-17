import type { AppSettings } from "../../../../../types";
import { Separator } from "@/components/ui/separator";
import type { ThreadSummary, WorkspaceInfo } from "../../../../../types";
import { HistoryCompletionSettings } from "../../HistoryCompletionSettings";
import {
  ProjectSessionManagementSection,
  type ProjectSessionDeleteResult,
} from "../../ProjectSessionManagementSection";
import { SessionRadarHistoryManagementSection } from "../../SessionRadarHistoryManagementSection";
import type { SessionRadarEntry } from "../../../../session-activity/hooks/useSessionRadarFeed";
import type { SessionRadarHistoryDeleteResult } from "../../../../session-activity/utils/sessionRadarHistoryManagement";
import { RuntimePoolSection } from "./RuntimePoolSection";

type GroupedWorkspace = {
  id: string | null;
  name: string;
  workspaces: WorkspaceInfo[];
};

type OtherSectionProps = {
  title: string;
  description: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  sessionRadarRecentCompletedSessions: SessionRadarEntry[];
  onDeleteSessionRadarHistory: (
    entries: SessionRadarEntry[],
  ) => Promise<SessionRadarHistoryDeleteResult>;
  workspace: WorkspaceInfo | null;
  workspaces: WorkspaceInfo[];
  groupedWorkspaces: GroupedWorkspace[];
  selectedWorkspaceId: string | null;
  onWorkspaceChange: (workspaceId: string | null) => void;
  threads: ThreadSummary[];
  loading: boolean;
  onEnsureWorkspaceThreads?: (workspaceId: string) => void;
  onDeleteWorkspaceThreads: (
    workspaceId: string,
    threadIds: string[],
  ) => Promise<ProjectSessionDeleteResult>;
};

export function OtherSection({
  title,
  description,
  t,
  appSettings,
  onUpdateAppSettings,
  sessionRadarRecentCompletedSessions,
  onDeleteSessionRadarHistory,
  workspace,
  workspaces,
  groupedWorkspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  threads,
  loading,
  onEnsureWorkspaceThreads,
  onDeleteWorkspaceThreads,
}: OtherSectionProps) {
  return (
    <section className="settings-section">
      <div className="settings-section-title">{title}</div>
      <div className="settings-section-subtitle">{description}</div>
      <RuntimePoolSection
        t={t}
        appSettings={appSettings}
        onUpdateAppSettings={onUpdateAppSettings}
      />
      <Separator className="my-4" />
      <HistoryCompletionSettings />
      <Separator className="my-4" />
      <SessionRadarHistoryManagementSection
        entries={sessionRadarRecentCompletedSessions}
        onDeleteEntries={onDeleteSessionRadarHistory}
      />
      <Separator className="my-4" />
      <ProjectSessionManagementSection
        workspace={workspace}
        workspaces={workspaces}
        groupedWorkspaces={groupedWorkspaces}
        selectedWorkspaceId={selectedWorkspaceId}
        onWorkspaceChange={onWorkspaceChange}
        threads={threads}
        loading={loading}
        onRefresh={onEnsureWorkspaceThreads ? (workspaceId) => onEnsureWorkspaceThreads(workspaceId) : undefined}
        onDeleteSessions={onDeleteWorkspaceThreads}
      />
    </section>
  );
}
