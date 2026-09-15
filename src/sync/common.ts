import type { PublishOutcomeStatus } from "~utils/publish-result";
import { TimeoutError, withTimeout } from "~utils/timeout";
import { getAccountInfoFromPlatformInfo, getAccountInfoFromPlatformInfos } from "./account";
import { ArticleInfoMap } from "./article";
import { DynamicInfoMap } from "./dynamic";
import { getExtraConfigFromPlatformInfo, getExtraConfigFromPlatformInfos } from "./extraconfig";
import { PodcastInfoMap } from "./podcast";
import { VideoInfoMap } from "./video";

/**
 * 国内平台流量池排序（accountKey → 权重，越小越靠前）。
 * 供 getPlatformInfos 排序：国内平台按流量大小放前面，国际平台放后面。
 */
const CN_PLATFORM_RANK: Record<string, number> = Object.fromEntries(
  [
    // 视频/短视频（用户体量最大）
    "douyin",
    "kuaishou",
    "weixinchannel",
    "weibo",
    "rednote",
    "weixin",
    "bilibili",
    "zhihu",
    "toutiao",
    "toutiaohao",
    "baijiahao",
    "qie",
    "douban",
    "xueqiu",
    "iqiyi",
    "youku",
    "tencentvideo",
    "ximalaya",
    "qqmusic",
    "netease",
    "sohu",
    "yidian",
    "dayu",
    "dingduanhao",
    "kuaichuanhao",
    "csdn",
    "juejin",
    "oschina",
    "segmentfault",
    "jianshu",
    "infoq",
    "sspai",
    "smzdm",
    "woshipm",
    "gelonghui",
    "eastmoney",
    "tonghuashun",
    "autohome",
    "chejiahao",
    "yiche",
    "dongchedi",
    "dewu",
    "pinduoduo",
    "alipay",
    "vivovideo",
    "xiaoheihe",
    "zsxq",
    "okjike",
    "maimai",
    "v2ex",
    "dedao",
    "neteasepodcast",
    "lizhi",
    "xiaoyuzhou",
    "qingting",
    "jiankangjie",
    "kaidiwang",
    "jianpian",
  ].map((key, i) => [key, i + 1]),
);

/**
 * 各发布类型的「常用平台」（accountKey），按用户指定顺序排在最前；
 * 其余平台统一归入「其它」分组，不与常用平台混在一起。
 */
const TYPE_PRIORITY_PLATFORMS: Record<string, string[]> = {
  DYNAMIC: ["weibo", "rednote", "zhihu", "x", "facebook"],
  VIDEO: ["douyin", "kuaishou", "weixinchannel", "bilibili", "weibo", "rednote", "youtube"],
  ARTICLE: ["weixin", "zhihu", "csdn", "51cto"],
};

/** 返回指定发布类型的常用平台 accountKey 列表（按用户指定顺序） */
export function getTypePriorityPlatformKeys(type?: "DYNAMIC" | "VIDEO" | "ARTICLE" | "PODCAST"): string[] {
  if (!type) return [];
  return TYPE_PRIORITY_PLATFORMS[type] ?? [];
}

export interface SyncDataPlatform {
  name: string;
  injectUrl?: string;
  extraConfig?:
    | {
        customInjectUrls?: string[]; // Beta 功能，用于自定义注入 URL
      }
    | unknown;
}

export interface SyncData {
  platforms: SyncDataPlatform[];
  isAutoPublish: boolean;
  data: DynamicData | ArticleData | VideoData | PodcastData;
  origin?: DynamicData | ArticleData | VideoData | PodcastData; // Beta 功能，用于临时存储，发布时不需要提供该字段
}

export interface DynamicData {
  title: string;
  content: string;
  images: FileData[];
  videos: FileData[];
  tags?: string[];
  scheduledPublishTime?: number;
}

export interface PodcastData {
  title: string;
  description: string;
  audio: FileData;
  cover?: FileData;
  tags?: string[];
  category?: string | number;
}

export interface FileData {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

export interface ArticleData {
  title: string;
  digest: string;
  cover: FileData;
  htmlContent: string;
  markdownContent: string;
  images?: FileData[]; // 发布时可不提供该字段
  tags?: string[];
  category?: string | number; // 平台分类 ID 或名称
  original?: boolean; // 原创声明
  allowComment?: boolean;
  scheduledPublishTime?: number;
}

export interface VideoData {
  title: string;
  content: string;
  video: FileData;
  tags?: string[];
  cover?: FileData;
  verticalCover?: FileData;
  horizontalCover?: FileData;
  videoFile?: File; // 原始 File 对象，用于避免 blob URL 问题
  scheduledPublishTime?: number;
  category?: string | number; // 平台分区 ID（如 B 站 tid，YouTube category）
  original?: boolean; // 原创声明
  collectionId?: string | number; // 合集/系列 ID（如 B 站 list_id）
  description?: string; // 描述（独立于 content/简介）
}

export interface PlatformInfo {
  type: "DYNAMIC" | "VIDEO" | "ARTICLE" | "PODCAST";
  name: string;
  homeUrl: string;
  faviconUrl?: string;
  iconifyIcon?: string;
  platformName: string;
  injectUrl: string;
  injectFunction: (data: SyncData) => Promise<void>;
  tags?: string[];
  accountKey: string;
  accountInfo?: AccountInfo;
  extraConfig?: unknown;
}

export interface AccountInfo {
  provider: string;
  accountId: string;
  username: string;
  description?: string;
  profileUrl?: string;
  avatarUrl?: string;
  extraData: unknown;
}

export const infoMap: Record<string, PlatformInfo> = {
  ...DynamicInfoMap,
  ...ArticleInfoMap,
  ...VideoInfoMap,
  ...PodcastInfoMap,
};

export async function getPlatformInfo(platform: string): Promise<PlatformInfo | null> {
  const platformInfo = infoMap[platform];
  if (platformInfo) {
    return await getExtraConfigFromPlatformInfo(await getAccountInfoFromPlatformInfo(platformInfo));
  }
  return null;
}

export function getRawPlatformInfo(platform: string): PlatformInfo | null {
  return infoMap[platform];
}

export async function getPlatformInfos(type?: "DYNAMIC" | "VIDEO" | "ARTICLE" | "PODCAST"): Promise<PlatformInfo[]> {
  const platformInfos: PlatformInfo[] = [];
  for (const info of Object.values(infoMap)) {
    if (type && info.type !== type) continue;
    platformInfos.push(info);
  }

  // 各发布类型的「常用平台」排最前（保持用户指定顺序），
  // 其次国内平台（tags 含 CN）按流量池大小排序，国际平台放后面（保持原顺序）
  const priorityKeys = getTypePriorityPlatformKeys(type);
  const priorityIndex = new Map(priorityKeys.map((key, i) => [key, i]));
  platformInfos.sort((a, b) => {
    const aPriority = priorityIndex.has(a.accountKey);
    const bPriority = priorityIndex.has(b.accountKey);
    if (aPriority !== bPriority) return aPriority ? -1 : 1;
    if (aPriority && bPriority) {
      return (priorityIndex.get(a.accountKey) ?? 0) - (priorityIndex.get(b.accountKey) ?? 0);
    }
    const aCN = a.tags?.includes("CN") ?? false;
    const bCN = b.tags?.includes("CN") ?? false;
    if (aCN !== bCN) return aCN ? -1 : 1;
    if (aCN && bCN) {
      const ar = CN_PLATFORM_RANK[a.accountKey] ?? 999;
      const br = CN_PLATFORM_RANK[b.accountKey] ?? 999;
      if (ar !== br) return ar - br;
    }
    return 0;
  });

  return await getExtraConfigFromPlatformInfos(await getAccountInfoFromPlatformInfos(platformInfos));
}

// Inject || 注入 || START

/** 单个平台的填充结果：由注入本身的成败推导，不需要各平台适配器配合改造。 */
export interface InjectOutcome {
  name: string;
  tabId?: number;
  status: PublishOutcomeStatus;
  /** 失败原因，直接展示给用户 */
  error?: string;
}

/** 等待标签页加载完成的超时；超时后仍继续注入，让适配器自己报出真实错误。 */
const TAB_LOAD_TIMEOUT_MS = 15_000;
/** 单个平台填充的超时上限，超过即视为「待确认」。 */
const INJECT_TIMEOUT_MS = 60_000;

/**
 * 等待标签页进入 complete。
 *
 * expectReload 为 true 时跳过「已经是 complete 就直接返回」的捷径：重试是先把页面重新加载再注入，
 * 若照常查询，可能读到的还是旧页面的 complete 状态，于是把内容填进一个即将被丢弃的页面。
 */
const waitForTabComplete = async (tabId: number, timeoutMs: number, expectReload = false) => {
  if (!expectReload) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || tab.status === "complete") return;
  }

  await new Promise<void>((resolve) => {
    function finish() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") finish();
    };
    chrome.tabs.onUpdated.addListener(listener);
    const timer = setTimeout(finish, timeoutMs);
  });
};

/**
 * 注入单个平台并给出填充结果。
 *
 * 结果来自 executeScript 本身：注入函数 resolve 记为「已填充」（内容写入了平台页面，
 * 是否真的发布由用户或平台页面决定，所以不叫成功），reject 记为「失败」并带回原因，
 * 超时记为「待确认」。
 */
const injectToTab = async (
  tab: chrome.tabs.Tab,
  platform: SyncDataPlatform,
  data: SyncData,
  expectReload = false,
): Promise<InjectOutcome> => {
  const tabId = tab.id;
  if (tabId === undefined) {
    return { name: platform.name, status: "failed", error: "标签页缺少 id" };
  }

  try {
    await waitForTabComplete(tabId, TAB_LOAD_TIMEOUT_MS, expectReload);
    const info = await getPlatformInfo(platform.name);
    if (!info) {
      return { name: platform.name, tabId, status: "failed", error: `未找到平台适配器：${platform.name}` };
    }
    await withTimeout(
      chrome.scripting.executeScript({
        target: { tabId },
        func: info.injectFunction,
        args: [data],
      }),
      INJECT_TIMEOUT_MS,
      `填充超过 ${INJECT_TIMEOUT_MS / 1000} 秒仍未返回`,
    );
    return { name: platform.name, tabId, status: "filled" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      name: platform.name,
      tabId,
      status: error instanceof TimeoutError ? "unconfirmed" : "failed",
      error: message,
    };
  }
};

export async function createTabsForPlatforms(data: SyncData) {
  const tabs: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }[] = [];
  /**
   * 各平台的填充结果。这里只收集不等待 —— 保持既有的「创建标签页 → 等加载 → 等 3 秒」节奏不变，
   * 结果由调用方在任务登记之后自行结算，避免早到的结果落到还没有记录的标签页上。
   */
  const injections: Promise<InjectOutcome[]>[] = [];
  let groupId: number | undefined;

  for (const info of data.platforms) {
    let tab: chrome.tabs.Tab | null = null;
    if (info) {
      const extraConfig = info.extraConfig as { customInjectUrls?: string[] };
      if (extraConfig?.customInjectUrls && extraConfig.customInjectUrls.length > 0) {
        for (const url of extraConfig.customInjectUrls) {
          tab = await chrome.tabs.create({ url });
          info.injectUrl = url;
          // 等待标签页加载完成
          await new Promise<void>((resolve) => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
              if (tabId === tab!.id && info.status === "complete") {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            });
          });
        }
      } else {
        if (info.injectUrl) {
          tab = await chrome.tabs.create({ url: info.injectUrl });
        } else {
          const platformInfo = infoMap[info.name];
          if (platformInfo) {
            tab = await chrome.tabs.create({ url: platformInfo.injectUrl });
          }
        }
        // 等待标签页加载完成
        if (tab) {
          injections.push(injectScriptsToTabs([{ tab, platformInfo: info }], data));
          await chrome.tabs.update(tab.id!, { active: true });
          tabs.push({
            tab,
            platformInfo: info,
          });

          // 如果是第一个标签页，创建一个新组
          if (!groupId) {
            groupId = await chrome.tabs.group({ tabIds: [tab.id!] });
            await chrome.tabGroups.update(groupId, {
              color: "blue",
              title: `pupu-${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
            });
          } else {
            // 将新标签页添加到现有组中
            await chrome.tabs.group({ tabIds: [tab.id!], groupId });
          }
          // 等待3秒再继续
          await new Promise<void>((resolve) => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
              if (tabId === tab!.id && info.status === "complete") {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            });
          });
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    }
  }

  return { tabs, injections };
}

export async function injectScriptsToTabs(
  tabs: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }[],
  data: SyncData,
  expectReload = false,
): Promise<InjectOutcome[]> {
  return await Promise.all(tabs.map((t) => injectToTab(t.tab, t.platformInfo, data, expectReload)));
}
// Inject || 注入 || END
