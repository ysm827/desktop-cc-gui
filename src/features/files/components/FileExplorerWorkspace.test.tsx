/** @vitest-environment jsdom */
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileExplorerWorkspace } from "./FileExplorerWorkspace";

const fileTreePanelSpy = vi.fn();
const fileViewPanelSpy = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./FileTreePanel", () => ({
  FileTreePanel: (props: any) => {
    fileTreePanelSpy(props);
    return (
      <div data-testid="file-tree-panel">
        <button type="button" onClick={() => props.onOpenSpecHub?.()}>
          open-spec-hub
        </button>
        <button type="button" onClick={() => props.onOpenFile?.("src/index.ts")}>
          open-file
        </button>
        <span>{props.isSpecHubActive ? "spec-active" : "spec-inactive"}</span>
      </div>
    );
  },
}));

vi.mock("./FileViewPanel", () => ({
  FileViewPanel: (props: any) => {
    fileViewPanelSpy(props);
    return <div data-testid="file-view-panel">{props.filePath}</div>;
  },
}));

vi.mock("../../spec/components/SpecHub", () => ({
  SpecHub: () => <div data-testid="spec-hub-panel">spec-hub</div>,
}));

function WorkspaceHarness() {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  return (
    <FileExplorerWorkspace
      workspaceId="workspace-1"
      workspaceName="workspace"
      workspacePath="/tmp/workspace"
      files={["src/index.ts"]}
      directories={["src"]}
      isLoading={false}
      gitStatusFiles={[{ path: "src/index.ts", status: "M", additions: 1, deletions: 0 }]}
      gitignoredFiles={new Set<string>()}
      gitignoredDirectories={new Set<string>()}
      openTargets={[]}
      openAppIconById={{}}
      selectedOpenAppId=""
      onSelectOpenAppId={() => undefined}
      openTabs={activeFilePath ? [activeFilePath] : []}
      activeFilePath={activeFilePath}
      navigationTarget={null}
      onOpenFile={(path) => setActiveFilePath(path)}
      onActivateTab={() => undefined}
      onCloseTab={() => undefined}
      onCloseAllTabs={() => setActiveFilePath(null)}
      onRefreshFiles={() => undefined}
    />
  );
}

describe("FileExplorerWorkspace", () => {
  it("switches the right viewer between spec hub and file content", () => {
    render(<WorkspaceHarness />);

    fireEvent.click(screen.getByText("open-spec-hub"));
    expect(screen.getByTestId("spec-hub-panel")).not.toBeNull();

    fireEvent.click(screen.getByText("open-file"));
    expect(screen.getByTestId("file-view-panel").textContent).toBe("src/index.ts");
    expect(fileTreePanelSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        gitStatusFiles: [{ path: "src/index.ts", status: "M", additions: 1, deletions: 0 }],
      }),
    );
    expect(fileViewPanelSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        gitStatusFiles: [{ path: "src/index.ts", status: "M", additions: 1, deletions: 0 }],
      }),
    );
  });
});
