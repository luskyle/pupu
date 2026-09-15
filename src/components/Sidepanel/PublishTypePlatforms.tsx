import { Card, CardBody, CardHeader, Spinner } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { type PlatformInfo, getPlatformInfos, getTypePriorityPlatformKeys } from "~sync/common";
import { logger } from "~utils/logger";

type PublishType = "DYNAMIC" | "VIDEO" | "ARTICLE";

/**
 * 侧边栏「当前发布类型平台」：跟随 options 页切换的动态/视频/文章 Tab 实时更新，
 * 常用平台单独列出，其余平台归入「其它」。切到「关于」页时尝试关闭侧边栏。
 */
export default function PublishTypePlatforms() {
  const [type, setType] = useState<PublishType>("DYNAMIC");
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [loading, setLoading] = useState(true);
  // 关于页：隐藏平台列表（关闭侧边栏失败时兜底）
  const [hidden, setHidden] = useState(false);
  const lastTabRef = useRef("");

  useEffect(() => {
    let alive = true;
    const readTab = async () => {
      const { activePublishTab } = await chrome.storage.local.get("activePublishTab");
      const raw = ((activePublishTab as string) || "dynamic").toLowerCase();
      // 值未变化：跳过（轮询与 onChanged 都会调用，这里去重）
      if (raw === lastTabRef.current) return;
      lastTabRef.current = raw;

      // 关于页：关闭侧边栏（浮动侧边栏可关；固定侧边栏关闭失败时隐藏内容）
      if (raw === "about") {
        window.close();
        if (alive) setHidden(true);
        return;
      }

      const t = raw.toUpperCase();
      if (t !== "DYNAMIC" && t !== "VIDEO" && t !== "ARTICLE") return;
      if (!alive) return;
      setHidden(false);
      setType(t);
      setPlatforms([]); // 清空旧数据，避免显示上一个类型的平台
      setLoading(true);
      try {
        const infos = await getPlatformInfos(t);
        if (alive) setPlatforms(infos);
      } catch (error) {
        logger.error("加载平台列表失败:", error);
      } finally {
        if (alive) setLoading(false);
      }
    };
    readTab();
    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && "activePublishTab" in changes) readTab();
    };
    chrome.storage.onChanged.addListener(onChange);
    // 轮询兜底：防止 onChanged 偶发不触发导致联动失效
    const interval = setInterval(readTab, 1000);
    return () => {
      alive = false;
      clearInterval(interval);
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);

  if (hidden) return null;

  const priorityKeys = getTypePriorityPlatformKeys(type);
  const priorityPlatforms = platforms.filter((p) => priorityKeys.includes(p.accountKey));
  const otherPlatforms = platforms.filter((p) => !priorityKeys.includes(p.accountKey));

  const renderRow = (p: PlatformInfo) => (
    <li key={p.name} className="flex items-center gap-2 py-0.5">
      {p.faviconUrl ? (
        <img
          src={p.faviconUrl}
          alt=""
          className="h-4 w-4 shrink-0 rounded-sm"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      ) : null}
      <span className="truncate text-sm">{p.platformName}</span>
    </li>
  );

  const typeLabel = chrome.i18n.getMessage(
    type === "DYNAMIC" ? "optionsDynamicTab" : type === "VIDEO" ? "optionsVideoTab" : "optionsPostTab",
  );
  const title = chrome.i18n.getMessage("sidepanelPlatformForTitle", [typeLabel]) || `${typeLabel}平台`;

  return (
    <Card className="shadow-none bg-default-50">
      <CardHeader className="pb-1">
        <h3 className="text-sm font-medium">{title}</h3>
      </CardHeader>
      <CardBody className="gap-3 pt-1">
        {loading ? (
          <div className="flex justify-center py-2">
            <Spinner size="sm" />
          </div>
        ) : (
          <>
            <div>
              <p className="mb-1 text-xs text-foreground/50">{chrome.i18n.getMessage("optionsPriorityPlatforms")}</p>
              <ul>{priorityPlatforms.map(renderRow)}</ul>
            </div>
            {otherPlatforms.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-foreground/50">{chrome.i18n.getMessage("optionsOtherPlatforms")}</p>
                <ul>{otherPlatforms.map(renderRow)}</ul>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
