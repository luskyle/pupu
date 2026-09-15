import { type SyncData, type SyncDataPlatform, injectScriptsToTabs } from "~sync/common";

// Tab Manager || 标签页管理 || START
export interface TabManagerMessage {
  syncData: SyncData;
  tabs: {
    tab: chrome.tabs.Tab;
    platformInfo: SyncDataPlatform;
  }[];
}

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
};

export const getTabsManagerMessages = () => {
  return tabsManagerMessages;
};

export const addTabsManagerMessages = (data: TabManagerMessage) => {
  tabsManagerMessages.push(data);
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
};

export const tabsManagerHandleTabUpdated = handleTabUpdated;
export const tabsManagerHandleTabRemoved = handleTabRemoved;

export const tabsManagerMessageHandler = (request, _sender, sendResponse) => {
  if (request.type === "PUPU_EXTENSION_REQUEST_PUBLISH_RELOAD") {
    const { tabId } = request.data;
    const info = tabsManagerMessages.find((group) => group.tabs.some((t) => t.tab.id === tabId));
    const tabInfo = info?.tabs.find((t) => t.tab.id === tabId);

    if (tabInfo) {
      chrome.tabs.update(tabId, { url: tabInfo.platformInfo.injectUrl, active: true }).then(() => {
        injectScriptsToTabs([{ tab: tabInfo.tab, platformInfo: tabInfo.platformInfo }], info.syncData);
      });
    } else {
      console.error(`未找到标签页 ID ${tabId} 的信息`);
      sendResponse("error");
      return true;
    }

    sendResponse("success");
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
