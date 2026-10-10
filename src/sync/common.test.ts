import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("platform tab creation", () => {
  it("registers and injects every custom URL instead of silently creating unused tabs", async () => {
    vi.useFakeTimers();
    const create = vi.fn(async ({ url }: { url: string }) => ({
      id: create.mock.calls.length,
      url,
      status: "complete",
    }));
    const execute = vi.fn(async () => []);
    vi.stubGlobal("chrome", {
      i18n: { getMessage: (key: string) => key },
      runtime: { getURL: (file: string) => file, getManifest: () => ({ manifest_version: 3 }) },
      storage: { local: { get: async () => ({}) }, onChanged: { addListener: vi.fn() } },
      tabs: {
        create,
        get: async () => ({ status: "complete" }),
        update: vi.fn(async () => ({})),
        group: vi.fn(async () => 1),
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      tabGroups: { update: vi.fn(async () => ({})) },
      scripting: { executeScript: execute },
    });
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
    await Promise.all(result.injections);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(data.platforms[0]).not.toHaveProperty("injectUrl");
  });
});
