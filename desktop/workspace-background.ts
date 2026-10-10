import {
  addTabsManagerMessages,
  collectInjectionResults,
  tabsManagerHandleTabRemoved,
  tabsManagerHandleTabUpdated,
  tabsManagerMessageHandler,
} from "../src/background/services/tabs";
import { getAllAccountInfo } from "../src/sync/account";
import { type SyncData, createTabsForPlatforms, getPlatformInfos, infoMap } from "../src/sync/common";
import { getWorkspaceExecution, registerWorkspaceAdapters } from "./workspace-chrome.js";

export function startWorkspaceBackground() {
  registerWorkspaceAdapters(infoMap);
  chrome.tabs.onUpdated.addListener(tabsManagerHandleTabUpdated);
  chrome.tabs.onRemoved.addListener(tabsManagerHandleTabRemoved);
  chrome.runtime.onMessage.addListener((request, sender, respond) => {
    if (tabsManagerMessageHandler(request, sender, respond)) return true;
    if (request.action === "PUPU_EXTENSION_PLATFORMS") {
      void getPlatformInfos().then(
        (platforms) => respond({ platforms }),
        (error) => respond({ error: String(error) }),
      );
      return true;
    }
    if (request.action === "PUPU_EXTENSION_GET_ACCOUNT_INFOS") {
      void getAllAccountInfo().then(
        (accountInfo) => respond({ accountInfo }),
        (error) => respond({ error: String(error) }),
      );
      return true;
    }
    if (request.action === "PUPU_EXTENSION_PUBLISH_NOW") {
      const data = request.data as SyncData;
      if (!Array.isArray(data?.platforms) || !data.platforms.length) {
        respond({ ok: false, error: "未选择发布平台" });
        return true;
      }
      void (async () => {
        await chrome.runtime.sendMessage({ type: "PUPU_DESKTOP_BATCH", running: true });
        try {
          const { tabs, injections } = await createTabsForPlatforms(data);
          if (!tabs.length) throw new Error("未创建平台任务");
          addTabsManagerMessages({
            syncData: data,
            tabs: tabs.map((item) => ({ ...item, result: { status: "pending", at: Date.now() } })),
          });
          collectInjectionResults(
            injections.map((injection) =>
              injection.then((outcomes) =>
                outcomes.map((outcome) =>
                  outcome.status === "filled" &&
                  (data.isAutoPublish || !getWorkspaceExecution(outcome.tabId)?.textVerified)
                    ? {
                        ...outcome,
                        status: "unconfirmed" as const,
                        error: data.isAutoPublish
                          ? "适配器执行已结束，但未核验平台成功回执；请查看平台，不要直接重发"
                          : "适配器执行已结束，但未核验标题/正文填写；请查看平台处理",
                      }
                    : outcome,
                ),
              ),
            ),
          );
          respond({ ok: true, tabs });
        } catch (error) {
          console.error("桌面发布任务创建失败", error);
          respond({ ok: false, error: String(error instanceof Error ? error.message : error) });
        } finally {
          await chrome.runtime.sendMessage({ type: "PUPU_DESKTOP_BATCH", running: false });
        }
      })();
      return true;
    }
    if (request.type === "PUPU_AGENT_TEST" || request.type === "PUPU_AGENT_SELECT_TITLE") {
      respond({ ok: false, error: "多平台迁移暂不启用标题 Agent；请使用独立 Agent 试点入口" });
      return true;
    }
    return false;
  });
}
