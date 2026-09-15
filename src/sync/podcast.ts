import type { PlatformInfo } from "./common";
import { PodcastLiZhi } from "./podcast/lizhi";
import { PodcastNetease } from "./podcast/netease";
import { PodcastQingting } from "./podcast/qingting";
import { PodcastQQMusic } from "./podcast/qqmusic";
import { PodcastSpotify } from "./podcast/spotify";
import { PodcastXiaoyuzhou } from "./podcast/xiaoyuzhou";
import { PodcastXimalaya } from "./podcast/ximalaya";

export const PodcastInfoMap: Record<string, PlatformInfo> = {
  PODCAST_QQMUSIC: {
    type: "PODCAST",
    name: "PODCAST_QQMUSIC",
    homeUrl: "https://mp.tencentmusic.com/index",
    faviconUrl: chrome.runtime.getURL("assets/platforms/qqmusic.ico"),
    platformName: chrome.i18n.getMessage("platformQQMusic"),
    injectUrl: "https://mp.tencentmusic.com/index",
    injectFunction: PodcastQQMusic,
    tags: ["CN"],
    accountKey: "qqmusic",
  },
  PODCAST_LIZHI: {
    type: "PODCAST",
    name: "PODCAST_LIZHI",
    homeUrl: "https://nj.lizhi.fm/static/newsite/#/index",
    faviconUrl: chrome.runtime.getURL("assets/platforms/lizhi.png"),
    platformName: chrome.i18n.getMessage("platformLizhi"),
    injectUrl: "https://nj.lizhi.fm/static/newsite/#/index",
    injectFunction: PodcastLiZhi,
    tags: ["CN"],
    accountKey: "lizhi",
  },
  PODCAST_XIMALAYA: {
    type: "PODCAST",
    name: "PODCAST_XIMALAYA",
    homeUrl: "https://creator.ximalaya.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/ximalaya.ico"),
    platformName: chrome.i18n.getMessage("platformXimalaya"),
    injectUrl: "https://creator.ximalaya.com/anchor/sound-album/sound/single-upload",
    injectFunction: PodcastXimalaya,
    tags: ["CN"],
    accountKey: "ximalaya",
  },
  PODCAST_XIAOYUZHOU: {
    type: "PODCAST",
    name: "PODCAST_XIAOYUZHOU",
    homeUrl: "https://podcaster.xiaoyuzhoufm.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/xiaoyuzhou.ico"),
    platformName: chrome.i18n.getMessage("platformXiaoyuzhou"),
    injectUrl: "https://podcaster.xiaoyuzhoufm.com/dashboard/episodes/new",
    injectFunction: PodcastXiaoyuzhou,
    tags: ["CN"],
    accountKey: "xiaoyuzhou",
  },
  PODCAST_QINGTING: {
    type: "PODCAST",
    name: "PODCAST_QINGTING",
    homeUrl: "https://studio.qingting.fm/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/qingting.png"),
    platformName: chrome.i18n.getMessage("platformQingting"),
    injectUrl: "https://studio.qingting.fm/album",
    injectFunction: PodcastQingting,
    tags: ["CN"],
    accountKey: "qingting",
  },
  PODCAST_NETEASE: {
    type: "PODCAST",
    name: "PODCAST_NETEASE",
    homeUrl: "https://podcast.music.163.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/neteasepodcast.ico"),
    platformName: chrome.i18n.getMessage("platformNeteasePodcast"),
    injectUrl: "https://podcast.music.163.com/web/podcast/upload",
    injectFunction: PodcastNetease,
    tags: ["CN"],
    accountKey: "neteasepodcast",
  },
  PODCAST_SPOTIFY: {
    type: "PODCAST",
    name: "PODCAST_SPOTIFY",
    homeUrl: "https://creators.spotify.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/spotify.png"),
    platformName: chrome.i18n.getMessage("platformSpotify"),
    injectUrl: "https://creators.spotify.com/pod/show",
    injectFunction: PodcastSpotify,
    tags: ["International"],
    accountKey: "spotify",
  },
};
