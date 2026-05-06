// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUseSpecHubState,
  getChangeGroupToggle,
  isReactActWarning,
  mockUseSpecHub,
  openOrFocusDetachedSpecHubMock,
  originalConsoleError,
} from "./SpecHub.test-support";
import { SpecHub } from "./SpecHub";
import { useSpecHub } from "../hooks/useSpecHub";

vi.mock("../hooks/useSpecHub", () => ({
  useSpecHub: vi.fn(),
}));

describe("SpecHub reader and layout behavior", () => {
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

  it("reflects collapsed control-center state and forwards toggle intent", () => {
    const setControlCenterCollapsed = vi.fn();
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded", {
        isControlCenterCollapsed: true,
        setControlCenterCollapsed,
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

    expect(document.querySelector(".spec-hub-grid")?.classList.contains("is-control-collapsed")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Expand control center" }));

    expect(setControlCenterCollapsed).toHaveBeenCalledWith(expect.any(Function));
    const updater = setControlCenterCollapsed.mock.calls[0]?.[0] as (previous: boolean) => boolean;
    expect(updater(true)).toBe(false);
  });

  it("keeps expand-collapse-all state isolated per filter view", () => {
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
              id: "2026-02-26-active-collapse",
              status: "ready",
              updatedAt: 3,
              artifacts: {
                proposalPath: "openspec/changes/2026-02-26-active-collapse/proposal.md",
                designPath: "openspec/changes/2026-02-26-active-collapse/design.md",
                tasksPath: "openspec/changes/2026-02-26-active-collapse/tasks.md",
                verificationPath: null,
                specPaths: [],
              },
              blockers: [],
              archiveBlockers: [],
            },
            {
              id: "legacy-active-collapse",
              status: "implementing",
              updatedAt: 2,
              artifacts: {
                proposalPath: "openspec/changes/legacy-active-collapse/proposal.md",
                designPath: "openspec/changes/legacy-active-collapse/design.md",
                tasksPath: "openspec/changes/legacy-active-collapse/tasks.md",
                verificationPath: null,
                specPaths: [],
              },
              blockers: [],
              archiveBlockers: [],
            },
            {
              id: "2026-02-26-archived-collapse",
              status: "archived",
              updatedAt: 1,
              artifacts: {
                proposalPath: "openspec/changes/archive/2026-02-26-archived-collapse/proposal.md",
                designPath: "openspec/changes/archive/2026-02-26-archived-collapse/design.md",
                tasksPath: "openspec/changes/archive/2026-02-26-archived-collapse/tasks.md",
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

    const allGroupToggle = getChangeGroupToggle(/2026-02-26/i);
    expect(allGroupToggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("2026-02-26-active-collapse")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(allGroupToggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("2026-02-26-active-collapse")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Archived" }));
    const archivedGroupToggle = getChangeGroupToggle(/2026-02-26/i);
    expect(archivedGroupToggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("2026-02-26-archived-collapse")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    const allGroupToggleAfterSwitch = getChangeGroupToggle(/2026-02-26/i);
    expect(allGroupToggleAfterSwitch.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(allGroupToggleAfterSwitch.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("2026-02-26-active-collapse")).toBeTruthy();
  });

  it("renders reader outline and opens the current reader context in a detached window", async () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded") as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace One"
        files={["openspec/changes/change-1/proposal.md"]}
        directories={["openspec"]}
        onBackToChat={() => {}}
      />,
    );

    expect(screen.queryByText("Reader Outline")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Expand reader outline" }));
    expect(await screen.findByText("Reader Outline")).not.toBeNull();
    expect(await screen.findByRole("button", { name: "Open in Window" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "spec-hub-workbench-ui" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open in Window" }));

    await waitFor(() => {
      expect(openOrFocusDetachedSpecHubMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-1",
          workspaceName: "Workspace One",
          files: ["openspec/changes/change-1/proposal.md"],
          directories: ["openspec"],
          changeId: "change-1",
          artifactType: "proposal",
        }),
      );
    });
  });

  it("supports collapsing and resizing the changes pane", async () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded") as ReturnType<typeof useSpecHub>,
    );

    const { container } = render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace One"
        files={["openspec/changes/change-1/proposal.md"]}
        directories={["openspec"]}
        onBackToChat={() => {}}
      />,
    );

    const surface = container.querySelector(".spec-hub-surface") as HTMLElement;
    const grid = container.querySelector(".spec-hub-grid") as HTMLElement;
    Object.defineProperty(grid, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        width: 1280,
        height: 720,
        top: 0,
        left: 0,
        right: 1280,
        bottom: 720,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Collapse changes pane" }));
    expect(surface.classList.contains("is-changes-collapsed")).toBe(true);

    const expandChangesButton = screen.getByRole("button", { name: "Expand changes pane" });
    expect(expandChangesButton.querySelector("svg")).not.toBeNull();

    fireEvent.click(expandChangesButton);
    expect(surface.classList.contains("is-changes-collapsed")).toBe(false);

    const resizer = screen.getByRole("separator", { name: "Resize changes pane" });
    fireEvent.pointerDown(resizer, { button: 0, clientX: 248 });
    fireEvent.pointerMove(window, { clientX: 328 });
    fireEvent.pointerUp(window);

    expect(surface.style.getPropertyValue("--spec-hub-changes-width")).toBe("328px");
  });

  it("keeps detached reader navigation collapsible without rendering the detach action again", async () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded") as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace One"
        files={["openspec/changes/change-1/proposal.md"]}
        directories={["openspec"]}
        onBackToChat={() => {}}
        surfaceMode="detached"
        detachedReaderSession={{
          workspaceId: "ws-1",
          workspaceName: "Workspace One",
          files: ["openspec/changes/change-1/proposal.md"],
          directories: ["openspec"],
          changeId: "change-1",
          artifactType: "proposal",
          specSourcePath: null,
          updatedAt: 1,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Expand reader outline" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Open in Window" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Expand reader outline" }));
    expect(await screen.findByText("Reader Outline")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Collapse reader outline" }));
    await waitFor(() => {
      expect(screen.queryByText("Reader Outline")).toBeNull();
    });
  });

  it("jumps from proposal capability to the matching spec source", async () => {
    mockUseSpecHub.mockReturnValue(
      createUseSpecHubState("No strict verify evidence recorded") as ReturnType<typeof useSpecHub>,
    );

    render(
      <SpecHub
        workspaceId="ws-1"
        workspaceName="Workspace One"
        files={["openspec/changes/change-1/proposal.md"]}
        directories={["openspec"]}
        onBackToChat={() => {}}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "spec-hub-workbench-ui" }));

    await waitFor(() => {
      expect(
        screen.getByText("openspec/changes/change-1/specs/spec-hub-workbench-ui/spec.md"),
      ).not.toBeNull();
    });
  });
});
