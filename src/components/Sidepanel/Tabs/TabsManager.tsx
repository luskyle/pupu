import { Button } from "@heroui/react";
import { Check, RefreshCw, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import type { TabManagerMessage } from "~background/services/tabs";
import { type PublishStatus, summarizePublishResults } from "~utils/publish-result";

/** 各填充状态的展示样式与文案 key */
const STATUS_STYLE: Record<PublishStatus, { className: string; labelKey: string }> = {
  pending: { className: "text-gray-500", labelKey: "sidepanelPublishStatusPending" },
  filled: { className: "text-green-600 dark:text-green-400", labelKey: "sidepanelPublishStatusFilled" },
  unconfirmed: { className: "text-amber-600 dark:text-amber-400", labelKey: "sidepanelPublishStatusUnconfirmed" },
  failed: { className: "text-red-600 dark:text-red-400", labelKey: "sidepanelPublishStatusFailed" },
};

function TabsManager() {
  const [tabGroup, setTabGroup] = useState<TabManagerMessage[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      chrome.runtime.sendMessage({ type: "PUPU_EXTENSION_TABS_MANAGER_REQUEST_TABS" }).then((data) => {
        setTabGroup(data);
      });
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleCloseTab = (tabId: number) => {
    chrome.tabs.remove(tabId, () => {
      setTabGroup((prevGroup) => {
        const updatedGroup = prevGroup.map((group) => ({
          ...group,
          tabs: group.tabs.filter((item) => item.tab.id !== tabId),
        }));
        // 过滤掉没有标签的组
        return updatedGroup.filter((group) => group.tabs.length > 0);
      });
    });
  };

  const handleSwitchTab = (tabId: number) => {
    chrome.tabs.update(tabId, { active: true });
  };

  const handleTabClick = (tabId: number) => {
    handleSwitchTab(tabId);
  };

  const handleTabMiddleClick = (e: React.MouseEvent<HTMLButtonElement>, tabId: number) => {
    if (e.button === 1) {
      e.preventDefault();
      handleCloseTab(tabId);
    }
  };

  // 重新加载平台页面并再次填充：对填充失败/待确认的平台，这就是「重试」
  const handleReloadTab = (tabGroup: TabManagerMessage, tabId: number) => {
    chrome.runtime.sendMessage({ type: "PUPU_EXTENSION_REQUEST_PUBLISH_RELOAD", data: { tabId, tabGroup } });
  };

  // 完成并删除整个发布任务：关闭该任务所有标签并从列表移除
  const handleCompleteTask = (group: TabManagerMessage) => {
    const tabId = group.tabs[0]?.tab.id;
    if (tabId !== undefined) {
      chrome.runtime.sendMessage({
        type: "PUPU_EXTENSION_TABS_MANAGER_REMOVE_TASK",
        data: { tabId },
      });
    }
    // 本地立即移除该任务，避免等待轮询刷新
    setTabGroup((prevGroup) => prevGroup.filter((g) => g !== group));
  };

  // 过滤掉没有标签的组
  const nonEmptyGroups = tabGroup.filter((group) => group.tabs.length > 0);

  return (
    <div className="p-4">
      {nonEmptyGroups.length > 0
        ? nonEmptyGroups.map((group, groupIndex) => {
            const summary = summarizePublishResults(group.tabs.map((item) => item.result));
            return (
              <div key={groupIndex} className="mb-6">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold truncate">
                      {group.syncData.data.title ||
                        chrome.i18n.getMessage("sidepanelUntitledGroup", `${groupIndex + 1}`)}
                    </h3>
                    <div className="text-xs text-gray-500">
                      {chrome.i18n.getMessage("sidepanelPublishSummary", [
                        String(summary.filled),
                        String(summary.failed),
                      ])}
                    </div>
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="success"
                    onPress={() => handleCompleteTask(group)}
                    aria-label={chrome.i18n.getMessage("sidepanelCompleteTask")}>
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
                <ul className="space-y-2">
                  {group.tabs.map((tabItem) => {
                    const status: PublishStatus = tabItem.result?.status ?? "pending";
                    const style = STATUS_STYLE[status];
                    const needsRetry = status === "failed" || status === "unconfirmed";
                    return (
                      <li key={tabItem.tab.id} className="flex relative items-center">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          className={`mr-2 ${status === "failed" ? "text-red-500" : ""}`}
                          onPress={() => handleReloadTab(group, tabItem.tab.id)}
                          aria-label={chrome.i18n.getMessage(
                            needsRetry ? "sidepanelPublishRetry" : "sidepanelReloadTab",
                          )}>
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <div className="grow min-w-0">
                          <Button
                            className="justify-start pl-2 pr-2 text-left w-full"
                            onPress={() => handleTabClick(tabItem.tab.id)}
                            onMouseDown={(e) => handleTabMiddleClick(e, tabItem.tab.id)}>
                            {tabItem.tab.favIconUrl && (
                              <img
                                src={tabItem.tab.favIconUrl}
                                alt=""
                                className="mr-2 w-4 h-4 shrink-0"
                                onError={(e) => (e.currentTarget.style.display = "none")}
                              />
                            )}
                            <span className="truncate">{tabItem.tab.title}</span>
                          </Button>
                          <div className="flex items-center gap-2 pl-2 mt-1">
                            <span className={`text-xs shrink-0 ${style.className}`}>
                              {chrome.i18n.getMessage(style.labelKey)}
                            </span>
                            {tabItem.result?.error && (
                              <span className="text-xs truncate text-red-500" title={tabItem.result.error}>
                                {tabItem.result.error}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          isIconOnly
                          size="sm"
                          color="danger"
                          variant="light"
                          className="ml-2"
                          onPress={() => handleCloseTab(tabItem.tab.id)}
                          aria-label={chrome.i18n.getMessage("sidepanelCloseTab")}>
                          <X className="w-4 h-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        : // 无发布标签时，侧边栏会由父组件自动关闭，这里不渲染空状态按钮/信息
          null}
    </div>
  );
}

export default TabsManager;
