import { Button, Image } from "@heroui/react";
import { Moon, Sun } from "lucide-react";
import type React from "react";
import AnonAvatar from "~components/AnonAvatar";
import { useTheme } from "~utils/theme";

/** 打开侧边栏刷新账号视图：写标记 + 在用户点击手势内打开侧边栏（不弹窗） */
async function openAccountsRefresh() {
  await chrome.storage.local.set({ refreshAccountsView: true });
  const window = await chrome.windows.getCurrent({ populate: true });
  await chrome.sidePanel.open({ windowId: window.id });
}

const Header: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  // 浏览器无法读取真实主机名/用户名，账户名固定用「本地用户」
  const accountName = chrome.i18n.getMessage("optionsLocalAccount") || "本地用户";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
      <div className="flex items-center justify-between w-full max-w-6xl px-4 mx-auto h-14">
        <div className="flex items-center gap-2.5">
          <Image src={chrome.runtime.getURL("assets/icon.png")} alt="logo" className="w-8 h-8 rounded-lg" />
          <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {chrome.i18n.getMessage("optionsTitle")}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          {/* 主题切换在账户左侧 */}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={toggleTheme}
            aria-label={chrome.i18n.getMessage(isDark ? "themeSwitchToLight" : "themeSwitchToDark")}
            className="text-slate-600 dark:text-slate-300"
            startContent={isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          />
          {/* 账户头像按钮：12 生肖头像 + 本地用户，点击展开侧边栏（刷新账号 / 清空缓存） */}
          <Button
            variant="light"
            onPress={openAccountsRefresh}
            aria-label={chrome.i18n.getMessage("optionsOpenAccounts") || "打开账号侧边栏"}
            className="h-10 gap-2 px-2 text-slate-700 dark:text-slate-200"
            startContent={<AnonAvatar className="h-8 w-8 rounded-full" />}>
            <span className="hidden text-sm font-medium sm:inline">{accountName}</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
