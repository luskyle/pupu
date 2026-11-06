import { Storage } from "@plasmohq/storage";
import { getAllAccountInfo } from "~sync/account";
import {
  // injectScriptsToTabs,
  type SyncData,
  type SyncDataPlatform,
  createTabsForPlatforms,
  getPlatformInfos,
} from "~sync/common";
import { logger } from "~utils/logger";
import { openSidebarFromBackground } from "~utils/sidebar";
import QuantumEntanglementKeepAlive from "../utils/keep-alive";
import { agentMessageHandler } from "./services/agent";
import { linkExtensionMessageHandler, starter } from "./services/api";
import { firefoxMediaMessageHandler } from "./services/firefox-media";
import {
  addTabsManagerMessages,
  collectInjectionResults,
  refreshPublishBadge,
  tabsManagerHandleTabRemoved,
  tabsManagerHandleTabUpdated,
  tabsManagerMessageHandler,
} from "./services/tabs";
import { trustDomainMessageHandler } from "./services/trust-domain";

const storage = new Storage({
  area: "local",
});

async function initDefaultTrustedDomains() {
  const trustedDomains = await storage.get<Array<{ id: string; domain: string }>>("trustedDomains");
  if (!trustedDomains) {
    await storage.set("trustedDomains", [
      {
        id: crypto.randomUUID(),
        domain: "pupu.app",
      },
    ]);
  }
}

chrome.runtime.onInstalled.addListener((object) => {
  if (object.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html#tab=about") });
  }
  initDefaultTrustedDomains();
  if (chrome.sidePanel?.setPanelBehavior) {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((error) => {
      logger.error("配置侧边栏失败:", error);
    });
  }
});

// Listen Message || 监听消息 || START
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handled =
    agentMessageHandler(request, sender, sendResponse) ||
    firefoxMediaMessageHandler(request, sender, sendResponse) ||
    defaultMessageHandler(request, sender, sendResponse) ||
    tabsManagerMessageHandler(request, sender, sendResponse) ||
    trustDomainMessageHandler(request, sender, sendResponse) ||
    linkExtensionMessageHandler(request, sender, sendResponse);
  return handled;
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  tabsManagerHandleTabUpdated(tabId, changeInfo, tab);
});
chrome.tabs.onRemoved.addListener((tabId) => {
  tabsManagerHandleTabRemoved(tabId);
});
// Listen Message || 监听消息 || END

// Message Handler || 消息处理器 || START
const defaultMessageHandler = (request, _sender, sendResponse) => {
  if (request.action === "PUPU_EXTENSION_CHECK_SERVICE_STATUS") {
    sendResponse({ extensionId: chrome.runtime.id });
    return true;
  }
  if (request.action === "PUPU_EXTENSION_PLATFORMS") {
    getPlatformInfos()
      .then((platforms) => {
        sendResponse({ platforms });
      })
      .catch((error) => {
        sendResponse({ error: String(error instanceof Error ? error.message : error) });
      });
    return true;
  }
  if (request.action === "PUPU_EXTENSION_GET_ACCOUNT_INFOS") {
    getAllAccountInfo()
      .then((accountInfo) => {
        sendResponse({ accountInfo });
      })
      .catch((error) => {
        sendResponse({ error: String(error instanceof Error ? error.message : error) });
      });
    return true;
  }
  if (request.action === "PUPU_EXTENSION_OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ extensionId: chrome.runtime.id });
    return true;
  }
  if (request.action === "PUPU_EXTENSION_REFRESH_ACCOUNT_INFOS") {
    void openSidebarFromBackground({ refreshAccountsView: true })
      .then(() => sendResponse({ status: "ok" }))
      .catch((error) => {
        logger.error("打开账号视图失败:", error);
        sendResponse({ status: "error", error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }
  if (request.action === "PUPU_EXTENSION_PUBLISH_NOW") {
    const data = request.data as SyncData;
    if (!Array.isArray(data.platforms) || data.platforms.length === 0) {
      sendResponse({ ok: false, error: "未选择发布平台" });
      return true;
    }
    (async () => {
      try {
        const { tabs, injections } = await createTabsForPlatforms(data);
        if (tabs.length === 0) {
          // 只创建了标签页分组却没有任何可注入的平台，等同于什么都没做，必须如实报错
          sendResponse({ ok: false, error: "没有创建任何平台标签页（可能缺少注入地址）" });
          return;
        }

        const payload = tabs.map((t: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }) => ({
          tab: t.tab,
          platformInfo: t.platformInfo,
        }));
        addTabsManagerMessages({
          syncData: data,
          tabs: payload.map((t) => ({ ...t, result: { status: "pending" as const, at: Date.now() } })),
        });
        // 各平台的填充结果异步写入任务记录，侧边栏据此展示成功/失败并支持重试
        collectInjectionResults(injections);

        sendResponse({ ok: true, tabs: payload });
      } catch (error) {
        // 必须回执失败：调用方按 ok 字段判定成败，而不是像以前那样把「没有回执」当成成功
        const message = error instanceof Error ? error.message : String(error);
        logger.error("创建标签页或分组时出错:", error);
        sendResponse({ ok: false, error: message });
      }
    })();
    return true;
  }
  return false;
};
starter(1000 * 30);
// 后台重启后发布任务记录已清空，徽标要跟着清掉，否则会留下上一次会话的失败计数
void refreshPublishBadge();
// Message Handler || 消息处理器 || END

// Keep Alive || 保活机制 || START
const quantumKeepAlive = new QuantumEntanglementKeepAlive();
quantumKeepAlive.startEntanglementProcess();
// Keep Alive || 保活机制 || END
