import { afterEach, describe, expect, it, vi } from "vitest";
import { closeSidebarWhenIdle, openSidebarFromBackground, openSidebarWithState } from "./sidebar";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sidebar compatibility", () => {
  it("opens the Firefox sidebar synchronously, before waiting for storage", async () => {
    let finishStorage: () => void = () => {};
    const set = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishStorage = resolve;
        }),
    );
    const open = vi.fn(async () => {});
    vi.stubGlobal("chrome", { storage: { local: { set } } });
    vi.stubGlobal("browser", { sidebarAction: { open } });

    const opening = openSidebarWithState({ pendingPublishData: "test" });
    expect(set).toHaveBeenCalledWith({ pendingPublishData: "test" });
    expect(open).toHaveBeenCalledOnce();
    finishStorage();
    await expect(opening).resolves.toBeUndefined();
  });

  it("uses the current window for the Chromium side panel", async () => {
    let finishStorage: () => void = () => {};
    const set = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishStorage = resolve;
        }),
    );
    const open = vi.fn(async () => {});
    const getCurrent = vi.fn(async () => ({ id: 12 }));
    vi.stubGlobal("browser", undefined);
    vi.stubGlobal("chrome", { storage: { local: { set } }, windows: { getCurrent }, sidePanel: { open } });

    const opening = openSidebarWithState({ refreshAccountsView: true });
    expect(set).toHaveBeenCalledWith({ refreshAccountsView: true });
    expect(getCurrent).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    finishStorage();
    await opening;
    expect(open).toHaveBeenCalledWith({ windowId: 12 });
  });

  it("reports sidebar opening failures", async () => {
    vi.stubGlobal("chrome", { storage: { local: { set: vi.fn(async () => {}) } } });
    vi.stubGlobal("browser", {
      sidebarAction: {
        open: vi.fn(async () => {
          throw new Error("not allowed");
        }),
      },
    });

    await expect(openSidebarWithState({})).rejects.toThrow("not allowed");
  });

  it("opens a Firefox extension tab for background requests without a user gesture", async () => {
    const set = vi.fn(async () => {});
    const create = vi.fn(async () => ({}));
    const open = vi.fn(async () => {});
    vi.stubGlobal("browser", { sidebarAction: { open } });
    vi.stubGlobal("chrome", {
      storage: { local: { set } },
      runtime: { getURL: (path: string) => `moz-extension://test/${path}` },
      tabs: { create },
    });

    await openSidebarFromBackground({ refreshAccountsView: true });
    expect(set).toHaveBeenCalledBefore(create);
    expect(create).toHaveBeenCalledWith({ url: "moz-extension://test/sidepanel.html" });
    expect(open).not.toHaveBeenCalled();
  });

  it("does not try to close Firefox sidebars without a user gesture", () => {
    const close = vi.fn();
    vi.stubGlobal("window", { close });
    vi.stubGlobal("browser", { sidebarAction: { open: vi.fn() } });
    closeSidebarWhenIdle();
    expect(close).not.toHaveBeenCalled();

    vi.stubGlobal("browser", undefined);
    closeSidebarWhenIdle();
    expect(close).toHaveBeenCalledOnce();
  });
});
