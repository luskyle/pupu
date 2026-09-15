import { Storage } from "@plasmohq/storage";
import { getAllAccountInfo } from "~sync/account";
import {
  // injectScriptsToTabs,
  type SyncData,
  type SyncDataPlatform,
  createTabsForPlatforms,
  getPlatformInfos,
} from "~sync/common";
import QuantumEntanglementKeepAlive from "../utils/keep-alive";
import { linkExtensionMessageHandler, starter } from "./services/api";
import {
  addTabsManagerMessages,
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
  if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html#tab=about") });
  }
  initDefaultTrustedDomains();
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

// Listen Message || 监听消息 || START
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handled =
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
    // 以侧边栏形式呈现刷新账号（不再弹窗）：写标记 + 打开侧边栏
    chrome.storage.local.set({ refreshAccountsView: true });
    chrome.windows.getCurrent({ populate: true }).then((w) => {
      if (w.id) chrome.sidePanel.open({ windowId: w.id });
    });
    sendResponse({ status: "ok" });
    return true;
  }
  if (request.action === "PUPU_EXTENSION_PUBLISH_NOW") {
    const data = request.data as SyncData;
    if (Array.isArray(data.platforms) && data.platforms.length > 0) {
      (async () => {
        try {
          const tabs = await createTabsForPlatforms(data);
          // await injectScriptsToTabs(tabs, data);

          addTabsManagerMessages({
            syncData: data,
            tabs: tabs.map((t: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }) => ({
              tab: t.tab,
              platformInfo: t.platformInfo,
            })),
          });

          // for (const t of tabs) {
          //   if (t.tab.id) {
          //     await chrome.tabs.update(t.tab.id, { active: true });
          //     await new Promise((resolve) => setTimeout(resolve, 2000));
          //   }
          // }

          sendResponse({
            tabs: tabs.map((t: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }) => ({
              tab: t.tab,
              platformInfo: t.platformInfo,
            })),
          });
        } catch (error) {
          // Do not sendResponse here: the publish popup's handlePublishComplete treats ANY
          // callback response as "publish complete", so an error payload would be mis-read as success.
          // Preserve original behavior (log only); success path above sends the tabs response.
          console.error("创建标签页或分组时出错:", error);
        }
      })();
    }
    // Claim this action regardless of platform count, mirroring the original blanket return-true:
    // the success path responds asynchronously; error/empty paths intentionally send no response.
    return true;
  }
  return false;
};
starter(1000 * 30);
// Message Handler || 消息处理器 || END

// Keep Alive || 保活机制 || START
const quantumKeepAlive = new QuantumEntanglementKeepAlive();
quantumKeepAlive.startEntanglementProcess();
// Keep Alive || 保活机制 || END
