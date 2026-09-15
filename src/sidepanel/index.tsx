import "~style.css";
import cssText from "data-text:~style.css";
import { HeroUIProvider } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import type { TabManagerMessage } from "~background/services/tabs";
import PublishConfirm, { type PublishOutcome, type PublishType } from "~components/Sidepanel/PublishConfirm";
import PublishTypePlatforms from "~components/Sidepanel/PublishTypePlatforms";
import TabsManager from "~components/Sidepanel/Tabs/TabsManager";
import type { SyncData } from "~sync/common";
import RefreshAccounts from "~tabs/refresh-accounts";
import { ThemeProvider } from "~utils/theme";

export function getShadowContainer() {
  return document.querySelector("#test-shadow").shadowRoot.querySelector("#plasmo-shadow-container");
}

export const getShadowHostId = () => "test-shadow";

export const getStyle = () => {
  const style = document.createElement("style");

  style.textContent = cssText;
  return style;
};

/** 发布中心点发布后暂存在 chrome.storage.local 的待发布内容 */
interface PendingPublish {
  type: PublishType;
  data: SyncData;
}

/** 连续多少秒没有待发布内容且没有发布标签时自动关闭侧边栏 */
const AUTO_CLOSE_DELAY_MS = 3000;

function SidePanel() {
  const [isReady, setIsReady] = useState(false);
  const [pending, setPending] = useState<PendingPublish | null>(null);
  const [hasTabs, setHasTabs] = useState(false);
  // 刷新账号视图标记（侧边栏形式呈现刷新账号）
  const [refreshView, setRefreshView] = useState(false);
  // 待发布内容初始加载是否完成（避免在加载完成前误判为空）
  const [pendingLoaded, setPendingLoaded] = useState(false);
  // 确认发布后等待发布标签出现，期间禁止自动关闭，避免误关
  const suppressAutoCloseRef = useRef(false);
  const pendingRef = useRef<PendingPublish | null>(null);

  useEffect(() => {
    document.title = chrome.i18n.getMessage("extensionDisplayName");
    // 先读取「刷新账号」标记：处于「关于」页时若直接渲染 PublishTypePlatforms 会被
    // about 检测立即 window.close()（侧边栏刚打开就关闭、打不开）。先确认 refreshView 再 isReady。
    void (async () => {
      try {
        const { refreshAccountsView } = await chrome.storage.local.get("refreshAccountsView");
        if (refreshAccountsView) {
          setRefreshView(true);
          await chrome.storage.local.set({ refreshAccountsView: false });
        }
      } catch {
        // 忽略读取异常
      }
      setIsReady(true);
    })();
  }, []);

  // 监听发布中心发来的待发布内容：有则进入「发布确认」界面，确认后才发布
  useEffect(() => {
    const loadPending = async () => {
      const { pendingPublishData } = await chrome.storage.local.get("pendingPublishData");
      setPending((pendingPublishData as PendingPublish) || null);
      setPendingLoaded(true);
    };

    loadPending();
    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && "pendingPublishData" in changes) {
        loadPending();
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);

  // 监听「刷新账号」视图标记：有则显示刷新账号界面并消费标记（下次打开不残留）
  useEffect(() => {
    const readRefresh = async () => {
      const { refreshAccountsView } = await chrome.storage.local.get("refreshAccountsView");
      if (refreshAccountsView) {
        setRefreshView(true);
        void chrome.storage.local.set({ refreshAccountsView: false });
      }
    };
    readRefresh();
    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && "refreshAccountsView" in changes && changes.refreshAccountsView.newValue) {
        setRefreshView(true);
        void chrome.storage.local.set({ refreshAccountsView: false });
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);

  // 轮询发布标签状态：是否有正在发布/已发布的标签
  useEffect(() => {
    const check = async () => {
      const data = (await chrome.runtime.sendMessage({
        type: "PUPU_EXTENSION_TABS_MANAGER_REQUEST_TABS",
      })) as TabManagerMessage[] | undefined;
      setHasTabs(Array.isArray(data) && data.some((group) => group.tabs.length > 0));
    };

    check();
    const interval = setInterval(check, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  // 确认/取消发布后 pending 变为空：确认发布则先禁止自动关闭，等待发布标签出现
  useEffect(() => {
    if (pendingRef.current && !pending) {
      suppressAutoCloseRef.current = true;
    }
    pendingRef.current = pending;
  }, [pending]);

  // 出现发布标签后恢复允许自动关闭
  useEffect(() => {
    if (hasTabs) {
      suppressAutoCloseRef.current = false;
    }
  }, [hasTabs]);

  // 没有待发布内容且没有发布标签 → 自动关闭侧边栏（刷新账号视图时不自动关闭）
  useEffect(() => {
    if (!pendingLoaded || suppressAutoCloseRef.current || refreshView) return;
    if (!pending && !hasTabs) {
      const timer = setTimeout(() => {
        if (!suppressAutoCloseRef.current && !pendingRef.current && !hasTabs) {
          window.close();
        }
      }, AUTO_CLOSE_DELAY_MS);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [pendingLoaded, pending, hasTabs, refreshView]);

  // 确认/取消/失败后的视图切换：失败时保留发布确认界面（由它就地展示失败原因并支持重试），
  // 否则清空待发布内容，交给发布标签列表接管
  const handlePublishDone = (outcome: PublishOutcome) => {
    if (outcome.status === "failed") return;
    if (outcome.status === "published") {
      suppressAutoCloseRef.current = true;
    }
    setPending(null);
  };

  if (!isReady) {
    return null;
  }

  return (
    <HeroUIProvider>
      <ThemeProvider>
        <div className="p-4 mx-auto min-h-screen dark:bg-slate-950 dark:text-slate-100">
          {pending ? (
            <PublishConfirm type={pending.type} data={pending.data} onDone={handlePublishDone} />
          ) : refreshView ? (
            <RefreshAccounts embedded />
          ) : (
            <div className="flex flex-col gap-4">
              <PublishTypePlatforms />
              <TabsManager />
            </div>
          )}
        </div>
      </ThemeProvider>
    </HeroUIProvider>
  );
}

export default SidePanel;
