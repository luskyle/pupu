import "~style.css";
import cssText from "data-text:~style.css";
import { HeroUIProvider, Tab, Tabs } from "@heroui/react";
import { FileText, Info, MessageSquareText, Video } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import Header from "~components/Header";
import AboutTab from "~components/Sync/AboutTab";
import ArticleTab from "~components/Sync/ArticleTab";
import DynamicTab from "~components/Sync/DynamicTab";
import VideoTab from "~components/Sync/VideoTab";
import { ThemeProvider } from "~utils/theme";

const LOCAL_TABS = ["dynamic", "video", "article", "about"] as const;
type LocalTab = (typeof LOCAL_TABS)[number];

const TAB_META: Record<LocalTab, { title: string; icon: ReactNode }> = {
  article: { title: chrome.i18n.getMessage("optionsPostTab") || "文章", icon: <FileText size={16} /> },
  dynamic: { title: chrome.i18n.getMessage("optionsDynamicTab") || "动态", icon: <MessageSquareText size={16} /> },
  video: { title: chrome.i18n.getMessage("optionsVideoTab") || "视频", icon: <Video size={16} /> },
  about: { title: "关于", icon: <Info size={16} /> },
};

function getInitialTab(): LocalTab {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const tab = params.get("tab") as LocalTab | null;
  return tab && LOCAL_TABS.includes(tab) ? tab : "dynamic";
}

export function getShadowContainer() {
  return document.querySelector("#test-shadow")?.shadowRoot?.querySelector("#plasmo-shadow-container");
}

export const getShadowHostId = () => "test-shadow";

export const getStyle = () => {
  const style = document.createElement("style");

  style.textContent = cssText;
  return style;
};

const renderTabContent = (key: LocalTab) => {
  switch (key) {
    case "article":
      return <ArticleTab />;
    case "dynamic":
      return <DynamicTab />;
    case "video":
      return <VideoTab />;
    case "about":
      return <AboutTab />;
  }
};

const Options = () => {
  const [selectedTab, setSelectedTab] = useState<LocalTab>(getInitialTab);

  // 通知侧边栏当前编辑的发布类型（动态/视频/文章），侧边栏平台列表跟随变化；切到关于页时侧边栏关闭
  const syncSidepanelTab = (tab: LocalTab) => {
    void chrome.storage.local.set({ activePublishTab: tab });
  };

  const updateSelectedTab = (tab: LocalTab) => {
    setSelectedTab(tab);
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    params.set("tab", tab);
    window.history.replaceState(null, "", `#${params.toString()}`);
    syncSidepanelTab(tab);
  };

  useEffect(() => {
    document.title = chrome.i18n.getMessage("syncPublicPageTitle") || chrome.i18n.getMessage("optionsTitle");

    const handleHashChange = () => {
      const next = getInitialTab();
      setSelectedTab(next);
      syncSidepanelTab(next);
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return (
    <HeroUIProvider>
      <ThemeProvider>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/70 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/60 dark:text-slate-100">
          <Header />

          <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {chrome.i18n.getMessage("syncPublicPageTitle") || "发布中心"}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">在本地编辑内容，一键同步到多个平台</p>
              </div>
              {/* 刷新账号 / 清空缓存已移至侧边栏：点击右上角账户头像展开 */}
            </div>

            <Tabs
              aria-label="发布类型"
              color="primary"
              selectedKey={selectedTab}
              onSelectionChange={(key) => updateSelectedTab(key as LocalTab)}
              classNames={{
                base: "w-full",
                tabList:
                  "w-full rounded-2xl border border-slate-200/70 bg-white/80 p-1.5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80",
                cursor: "rounded-xl bg-primary-100 dark:bg-primary-900",
                tab: "rounded-xl px-4 py-2.5",
                tabContent:
                  "group-data-[selected=true]:text-primary-700 dark:group-data-[selected=true]:text-primary-300",
              }}>
              {LOCAL_TABS.map((key) => (
                <Tab
                  key={key}
                  title={
                    <span className="flex items-center gap-2">
                      {TAB_META[key].icon}
                      {TAB_META[key].title}
                    </span>
                  }
                />
              ))}
            </Tabs>

            {/* 各 tab 内容保持挂载，仅通过 hidden 切换显示，以保留已填写的内容 */}
            <div className="px-0 pt-6">
              {LOCAL_TABS.map((key) => (
                <div key={key} className={selectedTab === key ? "" : "hidden"}>
                  {renderTabContent(key)}
                </div>
              ))}
            </div>
          </main>
        </div>
      </ThemeProvider>
    </HeroUIProvider>
  );
};

export default Options;
