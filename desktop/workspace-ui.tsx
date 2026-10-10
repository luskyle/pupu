import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Options from "../src/options";
import SidePanel from "../src/sidepanel";
import { startWorkspaceBackground } from "./workspace-background";

declare global {
  interface Window {
    pupuWorkspace: {
      invoke: (action: string, data?: unknown) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
      onEvent: (
        callback: (event: { type: string; id?: number; error?: string; message?: string }) => void,
      ) => () => void;
    };
  }
}

startWorkspaceBackground();

type WorkspaceTab = { id: number; title?: string; url?: string };

function Workspace() {
  const [panel, setPanel] = useState(true);
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);
  const [progress, setProgress] = useState("");
  const select = async (id: number) => {
    const response = await window.pupuWorkspace.invoke("select", id);
    if (!response.ok) setError(response.error || "切换平台失败");
  };
  useEffect(() => {
    const listener = () => setPanel(true);
    window.addEventListener("pupu:open-panel", listener);
    const refresh = () =>
      void chrome.tabs.query({}).then(
        (items) => setTabs(items.filter((item): item is chrome.tabs.Tab & { id: number } => item.id !== undefined)),
        (error) => setError(String(error)),
      );
    refresh();
    const unsubscribe = window.pupuWorkspace.onEvent((event) => {
      if (event.type === "error") setError(event.error || "平台操作失败");
      if (event.type === "selected") setSelected(event.id || 0);
      if (event.type === "progress") setProgress(event.message || "");
      refresh();
    });
    return () => {
      window.removeEventListener("pupu:open-panel", listener);
      unsubscribe();
    };
  }, []);
  return (
    <>
      <nav className="desktop-tabbar" aria-label="桌面平台标签">
        <button type="button" aria-current={selected === 0 ? "page" : undefined} onClick={() => void select(0)}>
          内容工作台 / 发布结果
        </button>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={selected === tab.id ? "page" : undefined}
            title={tab.url}
            onClick={() => void select(tab.id)}>
            {tab.title || "平台加载中"}
          </button>
        ))}
        {error && <span role="alert">{error}</span>}
      </nav>
      <div className="desktop-notice">
        多平台页面在本窗口后台运行，不会抢焦点。先在平台标签确认账号；「已填充」不代表发布成功。
        <button type="button" onClick={() => setPanel(!panel)}>
          {panel ? "收起" : "展开"}平台与任务
        </button>
        {progress && <output className="ml-3">{progress}</output>}
      </div>
      <div className="desktop-workspace">
        <div className="desktop-editor">
          <Options />
        </div>
        {panel && (
          <aside className="desktop-panel">
            <SidePanel />
          </aside>
        )}
      </div>
    </>
  );
}

const root = document.getElementById("workspace-root");
if (!root) throw new Error("工作台挂载点不存在");
createRoot(root).render(<Workspace />);
