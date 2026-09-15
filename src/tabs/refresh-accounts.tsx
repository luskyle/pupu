import "~style.css";
import cssText from "data-text:~style.css";
import { Button, HeroUIProvider, Image } from "@heroui/react";
import { CheckCircle2, ChevronRight, EraserIcon, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import InfoModal from "~components/Sync/Modals/InfoModal";
import { type RefreshResult, clearAllCache, refreshAllAccountInfo } from "~sync/account";
import { type AccountInfo, type PlatformInfo, getPlatformInfos, getTypePriorityPlatformKeys } from "~sync/common";
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

interface AccountState {
  isLoading: boolean;
  error: string | null;
  accounts: Record<string, AccountInfo>;
  errors: Record<string, string>;
}

interface RefreshAccountsProps {
  /** 侧边栏嵌入模式：去掉页面级 Provider 与布局，只渲染内容卡片 */
  embedded?: boolean;
}

const RefreshAccounts = ({ embedded = false }: RefreshAccountsProps = {}) => {
  const [state, setState] = useState<AccountState>({
    isLoading: true,
    error: null,
    accounts: {},
    errors: {},
  });
  // 分组列表：已登录（最前）、常用平台未登录、其它平台（折叠）
  const [logged, setLogged] = useState<PlatformInfo[]>([]);
  const [priority, setPriority] = useState<PlatformInfo[]>([]);
  const [others, setOthers] = useState<PlatformInfo[]>([]);
  const [showOthers, setShowOthers] = useState(false);
  // 加载圆点整组循环批次号（递增后所有点重新挂载重播动画）
  const [runId, setRunId] = useState(0);
  // 清空缓存二次确认弹窗
  const [clearOpen, setClearOpen] = useState(false);
  // 清空成功提示
  const [cleared, setCleared] = useState(false);

  // 加载全部平台账号信息并分组排序；forceRefresh=true 时才真正刷新（默认只读缓存，打开侧边栏/清空缓存不刷新）
  const loadAccounts = useCallback(async (forceRefresh = false) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const [allPlatforms, result] = await Promise.all([
        getPlatformInfos(),
        forceRefresh ? refreshAllAccountInfo() : Promise.resolve({ accounts: {}, errors: {} } as RefreshResult),
      ]);
      const hasAccount = (p: PlatformInfo) => !!result.accounts[p.accountKey] || !!p.accountInfo;
      // 按 accountKey 去重：infoMap 含同一平台在多个类型（动态/视频/文章）的条目，避免重复显示
      const unique = new Map<string, PlatformInfo>();
      for (const p of allPlatforms) {
        if (!unique.has(p.accountKey)) unique.set(p.accountKey, p);
      }
      // 动态/视频/文章指定的常用平台并集（保持用户指定顺序）
      const priorityKeys = [
        ...new Set([
          ...getTypePriorityPlatformKeys("DYNAMIC"),
          ...getTypePriorityPlatformKeys("VIDEO"),
          ...getTypePriorityPlatformKeys("ARTICLE"),
        ]),
      ];
      const priorityIndex = new Map(priorityKeys.map((key, i) => [key, i]));
      const rank = (p: PlatformInfo) =>
        priorityIndex.has(p.accountKey) ? (priorityIndex.get(p.accountKey) ?? 0) : 999;
      const all = [...unique.values()];
      // 已登录的平台排最前（其内常用平台优先）→ 常用平台（未登录）→ 其它平台（折叠区，保持原顺序）
      const loggedList = all.filter((p) => hasAccount(p)).sort((a, b) => rank(a) - rank(b));
      const priorityList = all
        .filter((p) => !hasAccount(p) && priorityIndex.has(p.accountKey))
        .sort((a, b) => rank(a) - rank(b));
      const othersList = all.filter((p) => !hasAccount(p) && !priorityIndex.has(p.accountKey));
      setLogged(loggedList);
      setPriority(priorityList);
      setOthers(othersList);
      setState({
        isLoading: false,
        error: null,
        accounts: result.accounts,
        errors: result.errors,
      });
    } catch (error) {
      setState({
        isLoading: false,
        error: error.message || chrome.i18n.getMessage("refreshAccountsError"),
        accounts: {},
        errors: {},
      });
    }
  }, []);

  // 清空账号缓存：真正执行删除 + 重新加载列表（界面刷新为未登录）+ 成功提示
  const handleClearCache = async () => {
    // 1. 确认弹框立即消失
    setClearOpen(false);
    // 2. 彻底清空缓存（浏览器本地存储 / 会话存储 / 扩展存储）
    await clearAllCache();
    // 3. 清空完成后开始刷新账号信息
    await loadAccounts(true);
    setCleared(true);
  };

  // 单条平台账号卡片（两列紧凑布局）
  const renderItem = (info: PlatformInfo) => {
    const account = state.accounts[info.accountKey] || info.accountInfo;
    const error = state.errors[info.accountKey];
    const displayName = account?.username || chrome.i18n.getMessage("optionsNotLoggedIn");

    return (
      <div key={info.name} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-900">
        <img
          src={account?.avatarUrl || info.faviconUrl}
          alt={info.platformName}
          className={`w-7 h-7 shrink-0 ${account?.avatarUrl ? "rounded-full" : "rounded-md"}`}
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-900 truncate dark:text-gray-100" title={displayName}>
            {displayName}
          </div>
          <div className="truncate text-[10px] text-gray-500 dark:text-gray-400">{info.platformName}</div>
          {error && <div className="truncate text-[10px] text-red-500">{error}</div>}
        </div>
        {account ? (
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
        )}
      </div>
    );
  };

  useEffect(() => {
    document.title = `${chrome.i18n.getMessage("refreshAccountsTitle")} - ${chrome.i18n.getMessage("extensionDisplayName")}`;
    // 打开侧边栏只用缓存加载列表，不刷新账号（点「刷新账号」才刷新）
    void loadAccounts(false);
  }, [loadAccounts]);

  // 加载圆点整组循环：最后一个小球运动完成（3.1s）后停顿 0.8s，再开始下一组
  const DOTS_CYCLE_MS = 3900;
  useEffect(() => {
    if (!state.isLoading) return undefined;
    const t = window.setTimeout(() => setRunId((v) => v + 1), DOTS_CYCLE_MS);
    return () => window.clearTimeout(t);
  }, [runId, state.isLoading]);

  const content = (
    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-slate-900 dark:border-slate-700">
      {/* Logo（去掉标题） */}
      <div className="flex items-center justify-center mb-4">
        <Image src={chrome.runtime.getURL("assets/icon.png")} alt="logo" className="w-10 h-10 rounded-lg" />
      </div>

      {/* 刷新 + 清空缓存（居中） */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onPress={() => void loadAccounts(true)} isDisabled={state.isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${state.isLoading ? "animate-spin" : ""}`} />
          {chrome.i18n.getMessage("refreshAccountsButton")}
        </Button>
        <Button
          color="danger"
          variant="flat"
          size="sm"
          onPress={() => setClearOpen(true)}
          startContent={<EraserIcon size={14} />}>
          {chrome.i18n.getMessage("clearAccountsButton") || "清空缓存"}
        </Button>
      </div>

      {/* 加载状态：6 个小球依次飞速到右端消失，停顿片刻后再开始下一组（无文字） */}
      {state.isLoading && (
        <div className="relative w-48 h-4 mx-auto my-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={`${runId}-${i}`}
              className="absolute bottom-0 left-0 h-1.5 w-1.5 rounded-full bg-primary-500 animate-dots-slide"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>
      )}

      {/* 错误状态 */}
      {state.error && (
        <div className="flex items-center justify-center p-3 mb-3 rounded-lg bg-red-50 dark:bg-red-950/40">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="ml-2 text-sm text-red-700 dark:text-red-300">{state.error}</span>
        </div>
      )}

      {/* 账户列表：已登录排最前，常用平台其后；其它平台折叠可展开 */}
      {!state.isLoading && !state.error && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">{[...logged, ...priority].map((info) => renderItem(info))}</div>
          {others.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowOthers((v) => !v)}
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200/70 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showOthers ? "rotate-90" : ""}`} />
                {chrome.i18n.getMessage("refreshAccountsOtherPlatforms") || "其它平台"} ({others.length})
              </button>
              {showOthers && (
                <div className="grid grid-cols-2 gap-2 mt-2">{others.map((info) => renderItem(info))}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 清空缓存二次确认（轻量弹窗，替代浏览器弹框） */}
      <InfoModal
        isOpen={clearOpen}
        title={chrome.i18n.getMessage("clearAccountsButton") || "清空缓存"}
        message={chrome.i18n.getMessage("clearAccountsConfirm") || "确定要清空所有账号缓存吗？"}
        confirmText={chrome.i18n.getMessage("clearAccountsButton") || "清空缓存"}
        danger
        onConfirm={() => void handleClearCache()}
        onClose={() => setClearOpen(false)}
      />
      {/* 清空成功提示 */}
      <InfoModal
        isOpen={cleared}
        message={chrome.i18n.getMessage("clearAccountsDone") || "账号缓存已清空"}
        onClose={() => setCleared(false)}
      />
    </div>
  );

  return embedded ? (
    content
  ) : (
    <HeroUIProvider>
      <ThemeProvider>
        <div className="min-h-screen bg-gray-50/30 dark:bg-slate-950">
          <div className="max-w-2xl p-4 mx-auto">{content}</div>
        </div>
      </ThemeProvider>
    </HeroUIProvider>
  );
};

export default RefreshAccounts;
