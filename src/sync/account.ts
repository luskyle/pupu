import { Storage } from "@plasmohq/storage";
import { ping } from "~background/services/api";
import { logger } from "~utils/logger";
import { getAlipayAccountInfo } from "./account/alipay";
import { getBilibiliAccountInfo } from "./account/bilibili";
import { getChejiahaoAccountInfo } from "./account/chejiahao";
import { getDayuAccountInfo } from "./account/dayu";
import { getDewuAccountInfo } from "./account/dewu";
import { getDouyinAccountInfo } from "./account/douyin";
import { getNeteaseAccountInfo } from "./account/netease";
import { getPinduoduoAccountInfo } from "./account/pinduoduo";
import { getQiEAccountInfo } from "./account/qie";
import { getRednoteAccountInfo } from "./account/rednote";
import { getSohuAccountInfo } from "./account/sohu";
import { getTiktokAccountInfo } from "./account/tiktok";
import { getVivoVideoAccountInfo } from "./account/vivovideo";
import { getXAccountInfo } from "./account/x";
import { getYicheAccountInfo } from "./account/yiche";
import { getYidianAccountInfo } from "./account/yidian";
import { type AccountInfo, type PlatformInfo, getPlatformInfos } from "./common";

// 存储账号信息的键名
export const ACCOUNT_INFO_STORAGE_KEY = "pupu_account_info";

// 初始化 storage 实例
const storage = new Storage({
  area: "local",
});

export const refreshAccountInfoMap: Record<
  string,
  {
    platformName: string;
    accountKey: string;
    homeUrl: string;
    faviconUrl: string;
    getAccountInfo: () => Promise<AccountInfo>;
  }
> = {
  x: {
    platformName: chrome.i18n.getMessage("platformX"),
    accountKey: "x",
    homeUrl: "https://x.com",
    faviconUrl: chrome.runtime.getURL("assets/platforms/x.png"),
    getAccountInfo: getXAccountInfo,
  },
  tiktok: {
    platformName: chrome.i18n.getMessage("platformTiktok"),
    accountKey: "tiktok",
    homeUrl: "https://www.tiktok.com",
    faviconUrl: chrome.runtime.getURL("assets/platforms/tiktok.png"),
    getAccountInfo: getTiktokAccountInfo,
  },
  douyin: {
    platformName: chrome.i18n.getMessage("platformDouyin"),
    accountKey: "douyin",
    homeUrl: "https://creator.douyin.com",
    faviconUrl: chrome.runtime.getURL("assets/platforms/douyin.ico"),
    getAccountInfo: getDouyinAccountInfo,
  },
  rednote: {
    platformName: chrome.i18n.getMessage("platformRednote"),
    accountKey: "rednote",
    homeUrl: "https://creator.xiaohongshu.com",
    faviconUrl: chrome.runtime.getURL("assets/platforms/rednote.ico"),
    getAccountInfo: getRednoteAccountInfo,
  },
  bilibili: {
    platformName: chrome.i18n.getMessage("platformBilibili"),
    accountKey: "bilibili",
    homeUrl: "https://t.bilibili.com",
    faviconUrl: chrome.runtime.getURL("assets/platforms/bilibili.ico"),
    getAccountInfo: getBilibiliAccountInfo,
  },
  qie: {
    platformName: chrome.i18n.getMessage("platformQiE"),
    accountKey: "qie",
    homeUrl: "https://om.qq.com",
    faviconUrl: chrome.runtime.getURL("assets/platforms/qie.png"),
    getAccountInfo: getQiEAccountInfo,
  },
  chejiahao: {
    platformName: chrome.i18n.getMessage("platformChejiahao"),
    accountKey: "chejiahao",
    homeUrl: "https://creator.autohome.com.cn",
    faviconUrl: chrome.runtime.getURL("assets/platforms/chejiahao.ico"),
    getAccountInfo: getChejiahaoAccountInfo,
  },
  dewu: {
    platformName: chrome.i18n.getMessage("platformDewu"),
    accountKey: "dewu",
    homeUrl: "https://creator.dewu.com",
    faviconUrl: chrome.runtime.getURL("assets/platforms/dewu.ico"),
    getAccountInfo: getDewuAccountInfo,
  },
  yiche: {
    platformName: chrome.i18n.getMessage("platformYiche"),
    accountKey: "yiche",
    homeUrl: "https://mp.yiche.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/yiche.ico"),
    getAccountInfo: getYicheAccountInfo,
  },
  sohu: {
    platformName: chrome.i18n.getMessage("platformSohu"),
    accountKey: "sohu",
    homeUrl: "https://mp.sohu.com",
    faviconUrl: chrome.runtime.getURL("assets/platforms/sohu.png"),
    getAccountInfo: getSohuAccountInfo,
  },
  netease: {
    platformName: chrome.i18n.getMessage("platformNetease"),
    accountKey: "netease",
    homeUrl: "https://dy.163.com",
    faviconUrl: chrome.runtime.getURL("assets/platforms/netease.png"),
    getAccountInfo: getNeteaseAccountInfo,
  },
  dayu: {
    platformName: chrome.i18n.getMessage("platformDayu"),
    accountKey: "dayu",
    homeUrl: "https://mp.dayu.com",
    faviconUrl: chrome.runtime.getURL("assets/platforms/dayu.ico"),
    getAccountInfo: getDayuAccountInfo,
  },
  alipay: {
    platformName: chrome.i18n.getMessage("platformAlipay"),
    accountKey: "alipay",
    homeUrl: "https://b.alipay.com",
    faviconUrl: chrome.runtime.getURL("assets/platforms/alipay.ico"),
    getAccountInfo: getAlipayAccountInfo,
  },
  yidian: {
    platformName: chrome.i18n.getMessage("platformYidian"),
    accountKey: "yidian",
    homeUrl: "https://yidian.com",
    faviconUrl: chrome.runtime.getURL("assets/platforms/yidian.ico"),
    getAccountInfo: getYidianAccountInfo,
  },
  pinduoduo: {
    platformName: chrome.i18n.getMessage("platformPinduoduo"),
    accountKey: "pinduoduo",
    homeUrl: "https://pinduoduo.com",
    faviconUrl: chrome.runtime.getURL("assets/platforms/pinduoduo.ico"),
    getAccountInfo: getPinduoduoAccountInfo,
  },
  vivovideo: {
    platformName: chrome.i18n.getMessage("platformVivoVideo"),
    accountKey: "vivovideo",
    homeUrl: "https://video.vivo.com.cn",
    faviconUrl: chrome.runtime.getURL("assets/platforms/vivovideo.png"),
    getAccountInfo: getVivoVideoAccountInfo,
  },
};

/**
 * 获取指定平台账号的最新信息
 * @param accountKey 账号标识符
 * @param platformInfosCache 可选的平台信息缓存（避免每个平台重复调用 getPlatformInfos 以加快刷新）
 * @returns 返回账号信息
 */
export async function refreshAccountInfo(
  accountKey: string,
  platformInfosCache?: PlatformInfo[],
): Promise<AccountInfo> {
  const platformInfos = platformInfosCache ?? (await getPlatformInfos());
  const platformInfo = platformInfos.find((p) => p.accountKey === accountKey);
  if (!platformInfo) {
    throw new Error(`找不到账号信息: ${accountKey}`);
  }

  const refreshInfo = refreshAccountInfoMap[accountKey];
  if (!refreshInfo) {
    logger.debug(`No account refresh handler for grouping-only account key: ${accountKey}`);
    await removeAccountInfo(accountKey);
    return null;
  }

  const accountInfo = await refreshInfo.getAccountInfo();

  if (!accountInfo) {
    logger.error(`获取账号信息失败: ${accountKey}`);
    removeAccountInfo(accountKey);
    return null;
  }

  // 更新平台信息并保存到storage
  await saveAccountInfo(accountKey, accountInfo);

  return accountInfo;
}

/**
 * 保存账号信息到storage
 * @param accountKey 账号标识符
 * @param accountInfo 账号信息
 */
async function saveAccountInfo(accountKey: string, accountInfo: AccountInfo): Promise<void> {
  // 获取当前存储的所有账号信息
  const accountInfoMap: Record<string, AccountInfo> = (await storage.get(ACCOUNT_INFO_STORAGE_KEY)) || {};

  // 更新指定平台的账号信息
  accountInfoMap[accountKey] = accountInfo;

  // 保存回storage
  await storage.set(ACCOUNT_INFO_STORAGE_KEY, accountInfoMap);
}

/**
 * 获取指定平台的账号信息，优先从storage获取
 * @param accountKey 账号标识符
 * @param forceRefresh 是否强制刷新
 * @returns 账号信息
 */
export async function getAccountInfo(accountKey: string, forceRefresh = false): Promise<AccountInfo> {
  if (forceRefresh) {
    return refreshAccountInfo(accountKey);
  }

  // 从storage中获取
  const accountInfoMap: Record<string, AccountInfo> = (await storage.get(ACCOUNT_INFO_STORAGE_KEY)) || {};

  if (accountInfoMap[accountKey]) {
    return accountInfoMap[accountKey];
  }

  // storage中没有，刷新获取
  return refreshAccountInfo(accountKey);
}

/**
 * 获取所有已保存的账号信息
 * @returns 账号信息映射表
 */
export async function getAllAccountInfo(): Promise<Record<string, AccountInfo>> {
  return (await storage.get(ACCOUNT_INFO_STORAGE_KEY)) || {};
}

/**
 * 从storage中移除指定账号信息
 * @param accountKey 账号标识符
 */
export async function removeAccountInfo(accountKey: string): Promise<void> {
  const accountInfoMap: Record<string, AccountInfo> = (await storage.get(ACCOUNT_INFO_STORAGE_KEY)) || {};

  if (accountInfoMap[accountKey]) {
    delete accountInfoMap[accountKey];
    await storage.set(ACCOUNT_INFO_STORAGE_KEY, accountInfoMap);
  }
}

export interface RefreshResult {
  accounts: Record<string, AccountInfo>;
  errors: Record<string, string>;
}

/**
 * 刷新所有平台的账号信息
 * @returns 所有账号信息的映射表和错误信息
 */
export async function refreshAllAccountInfo(): Promise<RefreshResult> {
  const results: Record<string, AccountInfo> = {};
  const errors: Record<string, string> = {};

  // 只获取一次平台信息，避免每个平台重复调用 getPlatformInfos（加快刷新速度）
  const platformInfos = await getPlatformInfos();

  // 并行刷新所有账号信息
  await Promise.allSettled(
    Object.entries(refreshAccountInfoMap).map(async ([accountKey]) => {
      try {
        if (accountKey) {
          const accountInfo = await refreshAccountInfo(accountKey, platformInfos);
          if (accountInfo) {
            results[accountKey] = accountInfo;
          } else {
            errors[accountKey] = chrome.i18n.getMessage("refreshAccountsNotLoggedIn");
          }
        }
      } catch (error) {
        logger.error(`刷新账号信息失败: ${accountKey}`, error);
        errors[accountKey] = (error as Error).message || chrome.i18n.getMessage("refreshAccountsError");
      }
    }),
  );

  await ping(true);

  return {
    accounts: results,
    errors,
  };
}

export async function getAccountInfoFromPlatformInfos(platformInfos: PlatformInfo[]): Promise<PlatformInfo[]> {
  const accountInfoMap: Record<string, AccountInfo> = (await storage.get(ACCOUNT_INFO_STORAGE_KEY)) || {};

  for (const platformInfo of platformInfos) {
    if (platformInfo.accountKey && accountInfoMap[platformInfo.accountKey]) {
      platformInfo.accountInfo = accountInfoMap[platformInfo.accountKey];
    }
  }

  return platformInfos;
}

export async function getAccountInfoFromPlatformInfo(platformInfo: PlatformInfo): Promise<PlatformInfo> {
  const accountInfoMap: Record<string, AccountInfo> = (await storage.get(ACCOUNT_INFO_STORAGE_KEY)) || {};
  if (platformInfo.accountKey && accountInfoMap[platformInfo.accountKey]) {
    platformInfo.accountInfo = accountInfoMap[platformInfo.accountKey];
  }
  return platformInfo;
}

/**
 * 清空所有平台域名的 Cookie（真正登出各平台，下次需重新登录认证）。
 * 从平台信息（homeUrl）收集所有域名（含二级父域），逐个 chrome.cookies.removeAll。
 * 需要 manifest "cookies" 权限 + host_permissions 覆盖所有 https 域名。
 */
export async function clearAllPlatformCookies(): Promise<void> {
  try {
    const platforms = await getPlatformInfos();
    // 收集所有平台域名（homeUrl 主机名 + 二级父域）
    const hosts = new Set<string>();
    for (const p of platforms) {
      if (!p.homeUrl) continue;
      try {
        const host = new URL(p.homeUrl).hostname;
        hosts.add(host);
        const parts = host.split(".");
        // 补上二级父域（如 t.bilibili.com → bilibili.com），覆盖父域 cookie
        if (parts.length > 2) hosts.add(parts.slice(-2).join("."));
      } catch {
        // 非法 URL 忽略
      }
    }
    // getAll({domain}) 匹配不到子域 host-only cookie（如 passport.bilibili.com），
    // 因此全量遍历浏览器可见 cookie，删除 domain 属于任一平台域（含其子域）的 cookie
    const allCookies = await chrome.cookies.getAll({});
    const baseHosts = [...hosts];
    let removed = 0;
    for (const cookie of allCookies) {
      const domain = cookie.domain.replace(/^\./, "");
      const isPlatform = baseHosts.some((h) => domain === h || domain.endsWith(`.${h}`));
      if (!isPlatform) continue;
      try {
        const cookieUrl = `${cookie.secure ? "https" : "http"}://${domain}${cookie.path}`;
        await chrome.cookies.remove({ url: cookieUrl, name: cookie.name });
        removed++;
      } catch {
        // 单个 cookie 失败忽略
      }
    }
    logger.debug(`[pupu-cache] 平台 Cookie 清理完成：${baseHosts.length} 个域名，删除 ${removed} 个 cookie`);
  } catch (error) {
    logger.error("[pupu-cache] 清理平台 Cookie 失败", error);
  }
}

/**
 * 彻底清空缓存：浏览器本地存储（localStorage）+ 会话存储（sessionStorage）
 * + 扩展存储中的账号信息缓存（pupu_account_info）与量子保活数据（quantumEntanglement）
 * + 所有平台域名的 Cookie（真正登出）。
 */
export async function clearAllCache(): Promise<void> {
  try {
    localStorage.clear();
  } catch {
    // 某些上下文可能无 localStorage，忽略
  }
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
  try {
    await chrome.storage.local.remove([ACCOUNT_INFO_STORAGE_KEY, "quantumEntanglement"]);
  } catch {
    // ignore
  }
  // 清空所有平台 Cookie（真正登出，下次需重新登录）
  await clearAllPlatformCookies();
}

/**
 * 清空账号信息缓存（行为升级：彻底清空本地 / 会话 / 扩展存储）
 */
export async function clearAllAccountInfo(): Promise<void> {
  await clearAllCache();
}
