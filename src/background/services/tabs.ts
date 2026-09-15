import { type InjectOutcome, type SyncData, type SyncDataPlatform, injectScriptsToTabs } from "~sync/common";
import { logger } from "~utils/logger";
import { type PublishTabResult, publishBadgeText, summarizePublishResults } from "~utils/publish-result";

// Tab Manager || 标签页管理 || START
export interface TabManagerTab {
  tab: chrome.tabs.Tab;
  platformInfo: SyncDataPlatform;
  /** 该平台的内容填充结果；标签页刚创建、尚无回执时为 undefined（界面按「发布中」展示） */
  result?: PublishTabResult;
}

export interface TabManagerMessage {
  syncData: SyncData;
  tabs: TabManagerTab[];
}

/** 失败徽标的底色（HeroUI danger） */
const BADGE_FAILED_COLOR = "#f31260";

const tabsManagerMessages: TabManagerMessage[] = [];

const handleTabUpdated = (tabId: number, _changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
  tabsManagerMessages.forEach((group, index) => {
    const updatedTabs = group.tabs.map((item) => (item.tab.id === tabId ? { ...item, tab } : item));
    tabsManagerMessages[index] = { ...group, tabs: updatedTabs };
  });
};

const handleTabRemoved = (tabId: number) => {
  // 倒序遍历，组内标签全部关闭后自动删除该发布任务（避免残留空组）
  for (let i = tabsManagerMessages.length - 1; i >= 0; i--) {
    const group = tabsManagerMessages[i];
    const filteredTabs = group.tabs.filter((item) => item.tab.id !== tabId);
    if (filteredTabs.length === 0) {
      tabsManagerMessages.splice(i, 1);
    } else {
      tabsManagerMessages[i] = { ...group, tabs: filteredTabs };
    }
  }
  void refreshPublishBadge();
};

export const getTabsManagerMessages = () => {
  return tabsManagerMessages;
};

export const addTabsManagerMessages = (data: TabManagerMessage) => {
  tabsManagerMessages.push(data);
};

/** 记录某个标签页的填充结果（发布结果汇总与徽标的唯一入口）。 */
export const setPublishTabResult = (tabId: number | undefined, result: PublishTabResult) => {
  if (tabId === undefined) return;

  let found = false;
  tabsManagerMessages.forEach((group, index) => {
    let touched = false;
    const tabs = group.tabs.map((item) => {
      if (item.tab.id !== tabId) return item;
      touched = true;
      return { ...item, result };
    });
    if (touched) {
      found = true;
      tabsManagerMessages[index] = { ...group, tabs };
    }
  });

  if (found) void refreshPublishBadge();
};

/** 汇总所有发布任务的失败数写到扩展图标徽标；没有失败就清除。 */
export const refreshPublishBadge = async () => {
  try {
    const summary = summarizePublishResults(tabsManagerMessages.flatMap((g) => g.tabs.map((t) => t.result)));
    const text = publishBadgeText(summary);
    await chrome.action.setBadgeText({ text });
    if (text) await chrome.action.setBadgeBackgroundColor({ color: BADGE_FAILED_COLOR });
  } catch (error) {
    logger.error("更新发布结果徽标失败:", error);
  }
};

/**
 * 结算各平台的填充结果。注入在 createTabsForPlatforms 里就已发出，这里只负责把结果写入记录，
 * 因此早到的结果也不会丢（写入时任务已经登记完毕）。
 */
export const collectInjectionResults = (injections: Promise<InjectOutcome[]>[]) => {
  for (const injection of injections) {
    void injection
      .then(([outcome]) => {
        if (!outcome) return;
        setPublishTabResult(outcome.tabId, {
          status: outcome.status,
          error: outcome.error,
          at: Date.now(),
        });
      })
      .catch((error) => {
        logger.error("结算填充结果失败:", error);
      });
  }
};

/** 删除一个发布任务：关闭该任务组内所有标签，并从任务列表移除 */
export const removeTabsManagerMessage = (group: TabManagerMessage) => {
  const idx = tabsManagerMessages.indexOf(group);
  if (idx !== -1) {
    tabsManagerMessages.splice(idx, 1);
  }
  group.tabs.forEach((item) => {
    if (item.tab.id !== undefined) {
      chrome.tabs.remove(item.tab.id).catch(() => undefined);
    }
  });
  void refreshPublishBadge();
};

export const tabsManagerHandleTabUpdated = handleTabUpdated;
export const tabsManagerHandleTabRemoved = handleTabRemoved;

/** 重新加载平台页面后再次注入，并把新的填充结果写回记录；失败时以 error 返回原因。 */
const reinjectPublishTab = async (tabId: number) => {
  const group = tabsManagerMessages.find((g) => g.tabs.some((t) => t.tab.id === tabId));
  const tabInfo = group?.tabs.find((t) => t.tab.id === tabId);
  if (!group || !tabInfo) {
    return { ok: false, error: "该发布任务已不存在" };
  }

  setPublishTabResult(tabId, { status: "pending", at: Date.now() });
  try {
    // 重新加载页面再注入，避免在「已经填过一半」的页面上重复填充
    await chrome.tabs.update(tabId, { url: tabInfo.platformInfo.injectUrl || tabInfo.tab.url, active: true });
    const [outcome] = await injectScriptsToTabs(
      [{ tab: tabInfo.tab, platformInfo: tabInfo.platformInfo }],
      group.syncData,
      // 刚触发过重新加载，必须等新页面加载完再注入（否则可能填进即将被丢弃的旧页面）
      true,
    );
    const result: PublishTabResult = {
      status: outcome?.status ?? "failed",
      error: outcome?.error ?? (outcome ? undefined : "未取得填充结果"),
      at: Date.now(),
    };
    setPublishTabResult(tabId, result);
    return { ok: result.status !== "failed", error: result.error, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("重新注入失败:", error);
    setPublishTabResult(tabId, { status: "failed", error: message, at: Date.now() });
    return { ok: false, error: message };
  }
};

export const tabsManagerMessageHandler = (request, _sender, sendResponse) => {
  // 重新加载平台页面 → 再次注入 → 回填结果；对填充失败/待确认的平台，界面就把它当「重试」用
  if (request.type === "PUPU_EXTENSION_REQUEST_PUBLISH_RELOAD") {
    const { tabId } = request.data;
    void reinjectPublishTab(tabId).then(sendResponse);
    return true;
  }
  if (request.type === "PUPU_EXTENSION_TABS_MANAGER_REQUEST_TABS") {
    sendResponse(getTabsManagerMessages());
    return true;
  }
  if (request.type === "PUPU_EXTENSION_TABS_MANAGER_REQUEST_ADD_TABS") {
    const { data, tabs } = request;
    addTabsManagerMessages({
      syncData: data,
      tabs: tabs.map((t: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }) => ({
        tab: t.tab,
        platformInfo: t.platformInfo,
      })),
    });
    sendResponse("success");
    return true;
  }
  // 按组内任一标签 id 定位并删除整个发布任务（完成并删除）
  if (request.type === "PUPU_EXTENSION_TABS_MANAGER_REMOVE_TASK") {
    const { tabId } = request.data;
    const group = tabsManagerMessages.find((g) => g.tabs.some((t) => t.tab.id === tabId));
    if (group) {
      removeTabsManagerMessage(group);
    }
    sendResponse("success");
    return true;
  }
  return false;
};

// Tab Manager || 标签页管理 || END
