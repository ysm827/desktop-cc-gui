// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { OpenAppTarget } from "../../../types";

const invokeMock = vi.fn(async (...args: any[]) => {
  const command = args[0];
  if (command === "list_workspace_directory_children") {
    return {
      files: [] as string[],
      directories: [] as string[],
      gitignored_files: [] as string[],
      gitignored_directories: [] as string[],
    };
  }
  if (command === "read_workspace_file") {
    return { content: "", truncated: false };
  }
  return null;
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (value: string) => value,
  invoke: (...args: any[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: {
    new: vi.fn(async () => ({
      append: vi.fn(async () => undefined),
      popup: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    })),
  },
  MenuItem: {
    new: vi.fn(async () => ({})),
  },
}));

vi.mock("@tauri-apps/api/dpi", () => ({
  LogicalPosition: class {},
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    scaleFactor: vi.fn(async () => 1),
  })),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: vi.fn(async () => true),
}));

let FileTreePanel: typeof import("./FileTreePanel").FileTreePanel;

beforeAll(async () => {
  ({ FileTreePanel } = await import("./FileTreePanel"));
});

afterEach(() => {
  cleanup();
  invokeMock.mockClear();
});

describe("FileTreePanel run action isolation", () => {
  it("filters files by search input", () => {
    render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
        files={["src/index.ts", "README.md"]}
        isLoading={false}
        filePanelMode="files"
        onFilePanelModeChange={() => undefined}
        onOpenFile={() => undefined}
        onInsertText={() => undefined}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        gitStatusFiles={[]}
        gitignoredFiles={new Set<string>()}
      />,
    );

    expect(screen.getByText("README.md")).toBeTruthy();
    const filterInput = screen.getByRole("searchbox", {
      name: "files.filterPlaceholder",
    });
    fireEvent.change(filterInput, { target: { value: "src/" } });
    expect(screen.queryByText("README.md")).toBeNull();
    expect(screen.getByText("src")).toBeTruthy();
  });

  it("renders empty directories from workspace directory snapshot", () => {
    render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
        files={["README.md"]}
        directories={["empty-dir"]}
        isLoading={false}
        filePanelMode="files"
        onFilePanelModeChange={() => undefined}
        onOpenFile={() => undefined}
        onInsertText={() => undefined}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        gitStatusFiles={[]}
        gitignoredFiles={new Set<string>()}
      />,
    );

    expect(screen.getByText("empty-dir")).toBeTruthy();
    expect(screen.getByText("README.md")).toBeTruthy();
  });

  it("renders single-child empty directory chains in a.b.c style", () => {
    render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
        files={[]}
        directories={["a/b/c"]}
        isLoading={false}
        filePanelMode="files"
        onFilePanelModeChange={() => undefined}
        onOpenFile={() => undefined}
        onInsertText={() => undefined}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        gitStatusFiles={[]}
        gitignoredFiles={new Set<string>()}
      />,
    );

    expect(screen.getByText("a.b.c")).toBeTruthy();
  });

  it("keeps matched empty directories visible when filtering", () => {
    render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
        files={["README.md"]}
        directories={["empty-dir"]}
        isLoading={false}
        filePanelMode="files"
        onFilePanelModeChange={() => undefined}
        onOpenFile={() => undefined}
        onInsertText={() => undefined}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        gitStatusFiles={[]}
        gitignoredFiles={new Set<string>()}
      />,
    );

    const filterInput = screen.getByRole("searchbox", {
      name: "files.filterPlaceholder",
    });
    fireEvent.change(filterInput, { target: { value: "empty" } });

    expect(screen.getByText("empty-dir")).toBeTruthy();
    expect(screen.queryByText("README.md")).toBeNull();
  });

  it("does not render run icon button in file tree search bar", () => {
    const openTargets: OpenAppTarget[] = [];

    render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
        files={[]}
        isLoading={false}
        filePanelMode="files"
        onFilePanelModeChange={() => undefined}
        onOpenFile={() => undefined}
        onInsertText={() => undefined}
        openTargets={openTargets}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        gitStatusFiles={[]}
        gitignoredFiles={new Set<string>()}
      />,
    );

    expect(screen.queryByRole("button", { name: "files.openRunConsole" })).toBeNull();
  });

  it("renders run icon button and triggers toggle when handler is provided", () => {
    const onToggleRuntimeConsole = vi.fn();
    render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
        files={[]}
        isLoading={false}
        filePanelMode="files"
        onFilePanelModeChange={() => undefined}
        onOpenFile={() => undefined}
        onInsertText={() => undefined}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        onToggleRuntimeConsole={onToggleRuntimeConsole}
        gitStatusFiles={[]}
        gitignoredFiles={new Set<string>()}
      />,
    );

    const runButton = screen.getByRole("button", { name: "files.openRunConsole" });
    fireEvent.click(runButton);
    expect(onToggleRuntimeConsole).toHaveBeenCalledTimes(1);
  });

  it("renders spec hub icon button and triggers toggle when handler is provided", () => {
    const onOpenSpecHub = vi.fn();
    render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
        files={[]}
        isLoading={false}
        filePanelMode="files"
        onFilePanelModeChange={() => undefined}
        onOpenFile={() => undefined}
        onInsertText={() => undefined}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        onOpenSpecHub={onOpenSpecHub}
        isSpecHubActive
        gitStatusFiles={[]}
        gitignoredFiles={new Set<string>()}
      />,
    );

    const specHubButton = screen.getByRole("button", { name: "sidebar.specHub" });
    expect(specHubButton.className).toContain("is-active");
    fireEvent.click(specHubButton);
    expect(onOpenSpecHub).toHaveBeenCalledTimes(1);
  });

  it("keeps file open interactions available after clicking run toggle", () => {
    const onToggleRuntimeConsole = vi.fn();
    const onOpenFile = vi.fn();
    render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
        files={["src/index.ts", "README.md"]}
        isLoading={false}
        filePanelMode="files"
        onFilePanelModeChange={() => undefined}
        onOpenFile={onOpenFile}
        onInsertText={() => undefined}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        onToggleRuntimeConsole={onToggleRuntimeConsole}
        gitStatusFiles={[]}
        gitignoredFiles={new Set<string>()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "files.openRunConsole" }));
    fireEvent.click(screen.getByRole("button", { name: "README.md" }));

    expect(onToggleRuntimeConsole).toHaveBeenCalledTimes(1);
    expect(onOpenFile).toHaveBeenCalledWith("README.md");
  });

  it("clicking folder row toggles children without opening file", () => {
    const onOpenFile = vi.fn();
    render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
        files={["src/index.ts"]}
        isLoading={false}
        filePanelMode="files"
        onFilePanelModeChange={() => undefined}
        onOpenFile={onOpenFile}
        onInsertText={() => undefined}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        gitStatusFiles={[]}
        gitignoredFiles={new Set<string>()}
      />,
    );

    expect(screen.queryByText("index.ts")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /src/ }));
    expect(screen.getByText("index.ts")).toBeTruthy();
    expect(onOpenFile).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalledWith(
      "list_workspace_directory_children",
      expect.any(Object),
    );
  });

  it("loads special directory children lazily when expanded", async () => {
    invokeMock.mockImplementation(async (...args: any[]) => {
      const command = args[0];
      if (command === "list_workspace_directory_children") {
        return {
          files: ["node_modules/package.json"],
          directories: [] as string[],
          gitignored_files: [] as string[],
          gitignored_directories: [] as string[],
        };
      }
      return null;
    });

    render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
        files={[]}
        directories={["node_modules"]}
        isLoading={false}
        filePanelMode="files"
        onFilePanelModeChange={() => undefined}
        onOpenFile={() => undefined}
        onInsertText={() => undefined}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        gitStatusFiles={[]}
        gitignoredFiles={new Set<string>()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /node_modules/ }));
    expect(await screen.findByText("package.json")).toBeTruthy();
    expect(invokeMock).toHaveBeenCalledWith("list_workspace_directory_children", {
      workspaceId: "workspace-1",
      path: "node_modules",
    });
  });

  it("loads nested directories lazily under special directory", async () => {
    invokeMock.mockImplementation(async (...args: any[]) => {
      const command = args[0];
      const payload = args[1];
      if (command !== "list_workspace_directory_children") {
        return null;
      }
      if (payload.path === "node_modules") {
        return {
          files: [] as string[],
          directories: ["node_modules/@babel"],
          gitignored_files: [] as string[],
          gitignored_directories: [] as string[],
        };
      }
      if (payload.path === "node_modules/@babel") {
        return {
          files: [] as string[],
          directories: ["node_modules/@babel/core"],
          gitignored_files: [] as string[],
          gitignored_directories: [] as string[],
        };
      }
      if (payload.path === "node_modules/@babel/core") {
        return {
          files: ["node_modules/@babel/core/index.js"],
          directories: [] as string[],
          gitignored_files: [] as string[],
          gitignored_directories: [] as string[],
        };
      }
      return {
        files: [] as string[],
        directories: [] as string[],
        gitignored_files: [] as string[],
        gitignored_directories: [] as string[],
      };
    });

    render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
        files={[]}
        directories={["node_modules"]}
        isLoading={false}
        filePanelMode="files"
        onFilePanelModeChange={() => undefined}
        onOpenFile={() => undefined}
        onInsertText={() => undefined}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        gitStatusFiles={[]}
        gitignoredFiles={new Set<string>()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /node_modules/ }));
    expect(await screen.findByRole("button", { name: /@babel/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /@babel/ }));
    expect(await screen.findByRole("button", { name: /core/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /core/ }));
    expect(await screen.findByText("index.js")).toBeTruthy();

    expect(invokeMock).toHaveBeenCalledWith("list_workspace_directory_children", {
      workspaceId: "workspace-1",
      path: "node_modules",
    });
    expect(invokeMock).toHaveBeenCalledWith("list_workspace_directory_children", {
      workspaceId: "workspace-1",
      path: "node_modules/@babel",
    });
    expect(invokeMock).toHaveBeenCalledWith("list_workspace_directory_children", {
      workspaceId: "workspace-1",
      path: "node_modules/@babel/core",
    });
  });

  it("shows retry action when special directory lazy load fails", async () => {
    invokeMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        files: ["node_modules/package-lock.json"],
        directories: [] as string[],
        gitignored_files: [] as string[],
        gitignored_directories: [] as string[],
      });

    render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
        files={[]}
        directories={["node_modules"]}
        isLoading={false}
        filePanelMode="files"
        onFilePanelModeChange={() => undefined}
        onOpenFile={() => undefined}
        onInsertText={() => undefined}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        gitStatusFiles={[]}
        gitignoredFiles={new Set<string>()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /node_modules/ }));
    expect(await screen.findByRole("button", { name: "加载失败，点击重试" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "加载失败，点击重试" }));
    await waitFor(() => {
      expect(screen.getByText("package-lock.json")).toBeTruthy();
    });
  });

  it("mentions file using Windows-style absolute path when workspace path uses backslashes", () => {
    const onInsertText = vi.fn();

    const { container } = render(
      <FileTreePanel
        workspaceId="workspace-1"
        workspacePath={"C:\\workspace\\demo"}
        files={["index.ts"]}
        isLoading={false}
        filePanelMode="files"
        onFilePanelModeChange={() => undefined}
        onOpenFile={() => undefined}
        onInsertText={onInsertText}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        gitStatusFiles={[]}
        gitignoredFiles={new Set<string>()}
      />,
    );

    const mentionButton = container.querySelector(".file-tree-action") as HTMLButtonElement | null;
    expect(mentionButton).not.toBeNull();
    fireEvent.click(mentionButton as HTMLButtonElement);

    expect(onInsertText).toHaveBeenCalledWith(
      "@C:\\workspace\\demo\\index.ts ",
    );
  });
});
