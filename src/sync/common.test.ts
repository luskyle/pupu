import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const testTab: chrome.tabs.Tab = {
  id: 3,
  index: 0,
  pinned: false,
  highlighted: true,
  windowId: 1,
  active: true,
  incognito: false,
  selected: true,
  discarded: false,
  autoDiscardable: true,
  groupId: -1,
};

function mockBrowser(
  options: {
    grouping?: boolean;
    firefox?: boolean;
    loadResults?: Array<{ result?: unknown; error?: unknown }>;
    results?: Array<{ result?: unknown; error?: unknown }>;
  } = {},
) {
  const create = vi.fn(async ({ url }: { url: string }) => ({
    id: create.mock.calls.length,
    url,
    status: "complete",
  }));
  const execute = vi.fn(async (details: { files?: string[] }) =>
    details.files ? (options.loadResults ?? [{ result: undefined }]) : (options.results ?? [{ result: undefined }]),
  );
  const group = vi.fn(async () => 1);
  const updateGroup = vi.fn(async () => ({}));
  const get = vi.fn(async () => ({ status: "complete", url: "https://example.com/edit" }));
  const listeners = new Set<(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void>();
  vi.stubGlobal("browser", options.firefox ? { runtime: { getBrowserInfo: vi.fn() } } : undefined);
  vi.stubGlobal("chrome", {
    i18n: { getMessage: (key: string) => key },
    runtime: { getURL: (file: string) => file, getManifest: () => ({ manifest_version: 3 }) },
    storage: { local: { get: async () => ({}) }, onChanged: { addListener: vi.fn() } },
    tabs: {
      create,
      get,
      update: vi.fn(async () => ({})),
      ...(options.grouping === false ? {} : { group }),
      onUpdated: {
        addListener: (listener: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void) =>
          listeners.add(listener),
        removeListener: (
          listener: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void,
        ) => listeners.delete(listener),
      },
    },
    ...(options.grouping === false ? {} : { tabGroups: { update: updateGroup } }),
    scripting: { executeScript: execute },
  });
  return { execute, get, group, listeners, updateGroup };
}

describe("platform tab creation", () => {
  it("registers and injects every custom URL instead of silently creating unused tabs", async () => {
    vi.useFakeTimers();
    const { execute, group, updateGroup } = mockBrowser();
    const { createTabsForPlatforms } = await import("./common");
    const data = {
      platforms: [
        {
          name: "ARTICLE_WORDPRESS",
          extraConfig: { customInjectUrls: ["https://one.example/edit", "https://two.example/edit"] },
        },
      ],
      isAutoPublish: false,
      data: { title: "test", digest: "", htmlContent: "<p>test</p>", markdownContent: "test", cover: null },
    };
    const pending = createTabsForPlatforms(data);
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result.tabs.map((item) => item.platformInfo.injectUrl)).toEqual([
      "https://one.example/edit",
      "https://two.example/edit",
    ]);
    expect(result.injections).toHaveLength(2);
    expect((await Promise.all(result.injections)).flat().map((outcome) => outcome.status)).toEqual([
      "filled",
      "filled",
    ]);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(group).toHaveBeenCalledTimes(2);
    expect(updateGroup).toHaveBeenCalledOnce();
    expect(data.platforms[0]).not.toHaveProperty("injectUrl");
  });

  it("opens and injects tabs when browser tab groups are unavailable", async () => {
    vi.useFakeTimers();
    const { execute, group } = mockBrowser({ grouping: false, firefox: true });
    const { createTabsForPlatforms } = await import("./common");
    const pending = createTabsForPlatforms({
      platforms: [{ name: "ARTICLE_WORDPRESS", injectUrl: "https://example.com/edit" }],
      isAutoPublish: false,
      data: { title: "test", digest: "", htmlContent: "", markdownContent: "", cover: null },
    });
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result.tabs).toHaveLength(1);
    expect((await result.injections[0])[0].status).toBe("filled");
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[0][0]).toMatchObject({ files: ["firefox-adapters.js"], target: { tabId: 1 } });
    expect(execute.mock.calls[1][0]).toMatchObject({ args: ["ARTICLE_WORDPRESS", expect.any(Object)] });
    expect(group).not.toHaveBeenCalled();
  });

  it.each([
    [[{ error: "script threw" }], "script threw"],
    [[], "没有页面执行填充脚本"],
  ])("reports Firefox execution errors instead of claiming a fill succeeded", async (results, message) => {
    mockBrowser({ grouping: false, firefox: true, results });
    const { injectScriptsToTabs } = await import("./common");
    const outcomes = await injectScriptsToTabs([{ tab: testTab, platformInfo: { name: "ARTICLE_WORDPRESS" } }], {
      platforms: [],
      isAutoPublish: false,
      data: { title: "test", digest: "", htmlContent: "", markdownContent: "", cover: null },
    });
    expect(outcomes[0]).toMatchObject({ status: "failed", error: expect.stringContaining(message) });
  });

  it("reports failure to load the Firefox adapter bundle", async () => {
    const { execute } = mockBrowser({ firefox: true, loadResults: [{ error: "adapter file missing" }] });
    const { injectScriptsToTabs } = await import("./common");
    const outcomes = await injectScriptsToTabs([{ tab: testTab, platformInfo: { name: "ARTICLE_WORDPRESS" } }], {
      platforms: [],
      isAutoPublish: false,
      data: { title: "test", digest: "", htmlContent: "", markdownContent: "", cover: null },
    });
    expect(outcomes[0]).toMatchObject({ status: "failed", error: "adapter file missing" });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("does not inject into Firefox's initial completed about:blank document", async () => {
    const { execute, get, listeners } = mockBrowser({ firefox: true });
    get.mockResolvedValue({ status: "complete", url: "about:blank" });
    const { injectScriptsToTabs } = await import("./common");
    const pending = injectScriptsToTabs([{ tab: testTab, platformInfo: { name: "ARTICLE_WORDPRESS" } }], {
      platforms: [],
      isAutoPublish: false,
      data: { title: "test", digest: "", htmlContent: "", markdownContent: "", cover: null },
    });

    await vi.waitFor(() => expect(listeners.size).toBe(1));
    for (const listener of listeners) {
      listener(3, { status: "complete" }, { ...testTab, status: "complete", url: "about:blank" });
    }
    expect(execute).not.toHaveBeenCalled();
    for (const listener of listeners) {
      listener(3, { status: "complete" }, { ...testTab, status: "complete", url: "https://example.com/edit" });
    }
    expect((await pending)[0].status).toBe("filled");
    expect(execute).toHaveBeenCalledTimes(2);
    expect(listeners.size).toBe(0);
  });
});
