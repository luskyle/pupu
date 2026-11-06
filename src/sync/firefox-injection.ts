import type { SyncData } from "./common";

declare global {
  var __pupuRunFirefoxAdapter: ((name: string, data: SyncData) => Promise<void>) | undefined;
}

function assertInjectionSucceeded(results: chrome.scripting.InjectionResult<unknown>[]): void {
  if (results.length === 0) throw new Error("没有页面执行填充脚本，请检查目标网站权限");
  for (const result of results) {
    if ("error" in result) {
      throw new Error(result.error instanceof Error ? result.error.message : String(result.error));
    }
  }
}

export async function injectFirefoxAdapter(tabId: number, platform: string, data: SyncData): Promise<void> {
  const loaded = await chrome.scripting.executeScript({
    target: { tabId },
    files: ["firefox-adapters.js"],
  });
  assertInjectionSucceeded(loaded);

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (name: string, syncData: SyncData) => {
      if (!globalThis.__pupuRunFirefoxAdapter) throw new Error("Firefox 平台适配器未加载");
      await globalThis.__pupuRunFirefoxAdapter(name, syncData);
    },
    args: [platform, data],
  });
  assertInjectionSucceeded(results);
}

export { assertInjectionSucceeded };
