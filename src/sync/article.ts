import { Article51CTO } from "./article/51cto";
import { ArticleAliyun } from "./article/aliyun";
import { ArticleAutohome } from "./article/autohome";
import { ArticleBaijiahao } from "./article/baijiahao";
import { ArticleBilibili } from "./article/bilibili";
import { ArticleCSDN } from "./article/csdn";
import { ArticleDaYuHao } from "./article/dayuhao";
import { ArticleDingduanhao } from "./article/dingduanhao";
import { ArticleDongchedi } from "./article/dongchedi";
import { ArticleDouban } from "./article/douban";
import { ArticleEastmoney } from "./article/eastmoney";
import { ArticleGeLongHui } from "./article/gelonghui";
import { ArticleInfoQ } from "./article/infoq";
import { ArticleJianKangJie } from "./article/jiankangjie";
import { ArticleJianpian } from "./article/jianpian";
import { ArticleJianshu } from "./article/jianshu";
import { ArticleJuejin } from "./article/juejin";
import { ArticleKaiDiWang } from "./article/kaidiwang";
import { ArticleKuaichuanhao } from "./article/kuaichuanhao";
import { ArticleMedium } from "./article/medium";
import { ArticleNetease } from "./article/netease";
import { ArticleOSChina } from "./article/oschina";
import { ArticleQQ } from "./article/qq";
import { ArticleSegmentfault } from "./article/segmentfault";
import { ArticleSMZDM } from "./article/smzdm";
import { ArticleSohu } from "./article/sohu";
import { ArticleSSPai } from "./article/sspai";
import { ArticleSubstack } from "./article/substack";
import { ArticleTencentyun } from "./article/tencentyun";
import { ArticleTonghuashun } from "./article/tonghuashun";
import { ArticleToutiao } from "./article/toutiao";
import { ArticleWeibo } from "./article/weibo";
import { ArticleWeixin } from "./article/weixin";
import { ArticleWordpress } from "./article/wordpress";
import { ArticleWoshipm } from "./article/woshipm";
import { ArticleXArticle } from "./article/xarticle";
import { ArticleXueqiu } from "./article/xueqiu";
import { ArticleYidianzixun } from "./article/yidianzixun";
import { ArticleZhihu } from "./article/zhihu";
import { ArticleZsxq } from "./article/zsxq";
import type { PlatformInfo } from "./common";

export const ArticleInfoMap: Record<string, PlatformInfo> = {
  ARTICLE_CSDN: {
    type: "ARTICLE",
    name: "ARTICLE_CSDN",
    homeUrl: "https://mp.csdn.net/mp_blog/creation/editor",
    faviconUrl: chrome.runtime.getURL("assets/platforms/csdn.ico"),
    platformName: chrome.i18n.getMessage("platformCSDN"),
    injectUrl: "https://mp.csdn.net/mp_blog/creation/editor",
    injectFunction: ArticleCSDN,
    tags: ["CN"],
    accountKey: "csdn",
  },
  ARTICLE_ZHIHU: {
    type: "ARTICLE",
    name: "ARTICLE_ZHIHU",
    homeUrl: "https://zhuanlan.zhihu.com/write",
    faviconUrl: chrome.runtime.getURL("assets/platforms/zhihu.ico"),
    platformName: chrome.i18n.getMessage("platformZhihu"),
    injectUrl: "https://zhuanlan.zhihu.com/write",
    injectFunction: ArticleZhihu,
    tags: ["CN"],
    accountKey: "zhihu",
  },
  ARTICLE_JUEJIN: {
    type: "ARTICLE",
    name: "ARTICLE_JUEJIN",
    homeUrl: "https://juejin.cn/editor/drafts/new?v=2",
    faviconUrl: chrome.runtime.getURL("assets/platforms/juejin.ico"),
    platformName: chrome.i18n.getMessage("platformJuejin"),
    injectUrl: "https://juejin.cn/editor/drafts/new?v=2",
    injectFunction: ArticleJuejin,
    tags: ["CN"],
    accountKey: "juejin",
  },
  ARTICLE_JIANSHU: {
    type: "ARTICLE",
    name: "ARTICLE_JIANSHU",
    homeUrl: "https://www.jianshu.com/writer",
    faviconUrl: chrome.runtime.getURL("assets/platforms/jianshu.ico"),
    platformName: chrome.i18n.getMessage("platformJianshu"),
    injectUrl: "https://www.jianshu.com/writer",
    injectFunction: ArticleJianshu,
    tags: ["CN"],
    accountKey: "jianshu",
  },
  ARTICLE_SEGMENTFAULT: {
    type: "ARTICLE",
    name: "ARTICLE_SEGMENTFAULT",
    homeUrl: "https://segmentfault.com/write",
    faviconUrl: chrome.runtime.getURL("assets/platforms/segmentfault.ico"),
    platformName: chrome.i18n.getMessage("platformSegmentfault"),
    injectUrl: "https://segmentfault.com/write",
    injectFunction: ArticleSegmentfault,
    tags: ["CN"],
    accountKey: "segmentfault",
  },
  // experimental(待线上验证):Aliyun ARTICLE DOM 路径
  ARTICLE_ALIYUN: {
    type: "ARTICLE",
    name: "ARTICLE_ALIYUN",
    homeUrl: "https://developer.aliyun.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/aliyun.ico"),
    platformName: chrome.i18n.getMessage("platformAliyun"),
    injectUrl: "https://developer.aliyun.com/article/new",
    injectFunction: ArticleAliyun,
    tags: ["CN"],
    accountKey: "aliyun",
  },
  // experimental(待线上验证):TencentYun ARTICLE DOM 路径
  ARTICLE_TENCENTYUN: {
    type: "ARTICLE",
    name: "ARTICLE_TENCENTYUN",
    homeUrl: "https://cloud.tencent.com/developer",
    faviconUrl: chrome.runtime.getURL("assets/platforms/tencentyun.ico"),
    platformName: chrome.i18n.getMessage("platformTencentyun"),
    injectUrl: "https://cloud.tencent.com/developer/article/write-new",
    injectFunction: ArticleTencentyun,
    tags: ["CN"],
    accountKey: "tencentyun",
  },
  ARTICLE_BAIJIAHAO: {
    type: "ARTICLE",
    name: "ARTICLE_BAIJIAHAO",
    homeUrl: "https://baijiahao.baidu.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/baijiahao.ico"),
    platformName: chrome.i18n.getMessage("platformBaijiahao"),
    injectUrl: "https://baijiahao.baidu.com/builder/rc/edit?type=news",
    injectFunction: ArticleBaijiahao,
    tags: ["CN"],
    accountKey: "baijiahao",
  },
  ARTICLE_TOUTIAO: {
    type: "ARTICLE",
    name: "ARTICLE_TOUTIAO",
    homeUrl: "https://mp.toutiao.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/toutiao.png"),
    platformName: chrome.i18n.getMessage("platformToutiao"),
    injectUrl: "https://mp.toutiao.com/profile_v4/graphic/publish",
    injectFunction: ArticleToutiao,
    tags: ["CN"],
    accountKey: "toutiao",
  },
  // experimental(待线上验证):QQ ARTICLE DOM 路径
  ARTICLE_QQ: {
    type: "ARTICLE",
    name: "ARTICLE_QQ",
    homeUrl: "https://om.qq.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/qie.png"),
    platformName: chrome.i18n.getMessage("platformQiE"),
    injectUrl: "https://om.qq.com/main/creation/article",
    injectFunction: ArticleQQ,
    tags: ["CN"],
    accountKey: "qie",
  },
  ARTICLE_DOUBAN: {
    type: "ARTICLE",
    name: "ARTICLE_DOUBAN",
    homeUrl: "https://www.douban.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/douban.ico"),
    platformName: chrome.i18n.getMessage("platformDouban"),
    injectUrl: "https://www.douban.com/note/create",
    injectFunction: ArticleDouban,
    tags: ["CN"],
    accountKey: "douban",
  },
  ARTICLE_WEIXIN: {
    type: "ARTICLE",
    name: "ARTICLE_WEIXIN",
    homeUrl: "https://mp.weixin.qq.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/weixin.png"),
    platformName: chrome.i18n.getMessage("platformWeixin"),
    injectUrl: "https://mp.weixin.qq.com/",
    injectFunction: ArticleWeixin,
    tags: ["CN"],
    accountKey: "weixin",
  },
  ARTICLE_WORDPRESS: {
    type: "ARTICLE",
    name: "ARTICLE_WORDPRESS",
    homeUrl: "https://wordpress.com/wp-admin/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/wordpress.ico"),
    platformName: chrome.i18n.getMessage("platformWordpress"),
    injectUrl: "https://wordpress.com/wp-admin/new-post.php",
    injectFunction: ArticleWordpress,
    tags: ["International"],
    accountKey: "wordpress",
  },
  ARTICLE_BILIBILI: {
    type: "ARTICLE",
    name: "ARTICLE_BILIBILI",
    homeUrl: "https://www.bilibili.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/bilibili.ico"),
    platformName: chrome.i18n.getMessage("platformBilibili"),
    injectUrl: "https://member.bilibili.com/article-text/home?newEditor=-1",
    injectFunction: ArticleBilibili,
    tags: ["CN"],
    accountKey: "bilibili",
  },
  ARTICLE_SSPAI: {
    type: "ARTICLE",
    name: "ARTICLE_SSPAI",
    homeUrl: "https://sspai.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/sspai.ico"),
    platformName: chrome.i18n.getMessage("platformSSPai"),
    injectUrl: "https://sspai.com/write",
    injectFunction: ArticleSSPai,
    tags: ["CN"],
    accountKey: "sspai",
  },
  ARTICLE_51CTO: {
    type: "ARTICLE",
    name: "ARTICLE_51CTO",
    homeUrl: "https://www.51cto.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/51cto.ico"),
    platformName: chrome.i18n.getMessage("platform51CTO"),
    injectUrl: "https://blog.51cto.com/blogger/publish?old=1",
    injectFunction: Article51CTO,
    tags: ["CN"],
    accountKey: "51cto",
  },
  ARTICLE_XUEQIU: {
    type: "ARTICLE",
    name: "ARTICLE_XUEQIU",
    homeUrl: "https://xueqiu.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/xueqiu.ico"),
    platformName: chrome.i18n.getMessage("platformXueqiu"),
    injectUrl: "https://mp.xueqiu.com/writeV2?position=pc_home_primary",
    injectFunction: ArticleXueqiu,
    tags: ["CN"],
    accountKey: "xueqiu",
  },
  ARTICLE_WEIBO: {
    type: "ARTICLE",
    name: "ARTICLE_WEIBO",
    homeUrl: "https://weibo.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/weibo.ico"),
    platformName: chrome.i18n.getMessage("platformWeibo"),
    injectUrl: "https://card.weibo.com/article/v3/editor",
    injectFunction: ArticleWeibo,
    tags: ["CN"],
    accountKey: "weibo",
  },
  ARTICLE_EASTMONEY: {
    type: "ARTICLE",
    name: "ARTICLE_EASTMONEY",
    homeUrl: "https://www.eastmoney.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/eastmoney.ico"),
    platformName: chrome.i18n.getMessage("platformEastmoney"),
    injectUrl: "https://mp.eastmoney.com/collect/pc_article/index.html",
    injectFunction: ArticleEastmoney,
    tags: ["CN"],
    accountKey: "eastmoney",
  },
  ARTICLE_SUBSTACK: {
    type: "ARTICLE",
    name: "ARTICLE_SUBSTACK",
    homeUrl: "https://substack.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/substack.svg"),
    platformName: chrome.i18n.getMessage("platformSubstack"),
    injectUrl: "https://substack.com/publish/post",
    injectFunction: ArticleSubstack,
    tags: ["International"],
    accountKey: "substack",
  },
  ARTICLE_MEDIUM: {
    type: "ARTICLE",
    name: "ARTICLE_MEDIUM",
    homeUrl: "https://medium.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/medium.svg"),
    platformName: chrome.i18n.getMessage("platformMedium"),
    injectUrl: "https://medium.com/new-story",
    injectFunction: ArticleMedium,
    tags: ["International"],
    accountKey: "medium",
  },
  ARTICLE_OSCHINA: {
    type: "ARTICLE",
    name: "ARTICLE_OSCHINA",
    homeUrl: "https://www.oschina.net/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/oschina.ico"),
    platformName: chrome.i18n.getMessage("platformOSChina"),
    injectUrl: "https://my.oschina.net/new/blog",
    injectFunction: ArticleOSChina,
    tags: ["CN"],
    accountKey: "oschina",
  },
  ARTICLE_INFOQ: {
    type: "ARTICLE",
    name: "ARTICLE_INFOQ",
    homeUrl: "https://www.infoq.cn/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/infoq.png"),
    platformName: chrome.i18n.getMessage("platformInfoQ"),
    injectUrl: "https://xie.infoq.cn/",
    injectFunction: ArticleInfoQ,
    tags: ["CN"],
    accountKey: "infoq",
  },
  ARTICLE_SMZDM: {
    type: "ARTICLE",
    name: "ARTICLE_SMZDM",
    homeUrl: "https://www.smzdm.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/smzdm.ico"),
    platformName: chrome.i18n.getMessage("platformSMZDM"),
    injectUrl: "https://zhiyou.smzdm.com/user/article/post",
    injectFunction: ArticleSMZDM,
    tags: ["CN"],
    accountKey: "smzdm",
  },
  ARTICLE_WOSHIPM: {
    type: "ARTICLE",
    name: "ARTICLE_WOSHIPM",
    homeUrl: "https://www.woshipm.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/woshipm.ico"),
    platformName: chrome.i18n.getMessage("platformWoshipm"),
    injectUrl: "https://www.woshipm.com/wp-admin/post-new.php",
    injectFunction: ArticleWoshipm,
    tags: ["CN"],
    accountKey: "woshipm",
  },
  // experimental: Gelonghui ARTICLE DOM path
  ARTICLE_GELONGHUI: {
    type: "ARTICLE",
    name: "ARTICLE_GELONGHUI",
    homeUrl: "https://www.gelonghui.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/gelonghui.ico"),
    platformName: chrome.i18n.getMessage("platformGelonghui"),
    injectUrl: "https://www.gelonghui.com/articleCreate/",
    injectFunction: ArticleGeLongHui,
    tags: ["CN"],
    accountKey: "gelonghui",
  },
  // experimental: Jiankangjie ARTICLE DOM path
  ARTICLE_JIANKANGJIE: {
    type: "ARTICLE",
    name: "ARTICLE_JIANKANGJIE",
    homeUrl: "https://www.cn-healthcare.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/jiankangjie.png"),
    platformName: chrome.i18n.getMessage("platformJiankangjie"),
    injectUrl: "https://ucenter.cn-healthcare.com/article/revision/newedit",
    injectFunction: ArticleJianKangJie,
    tags: ["CN"],
    accountKey: "jiankangjie",
  },
  // experimental: Kaidiwang ARTICLE DOM path
  ARTICLE_KAIDIWANG: {
    type: "ARTICLE",
    name: "ARTICLE_KAIDIWANG",
    homeUrl: "https://www.9kd.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/kaidiwang.ico"),
    platformName: chrome.i18n.getMessage("platformKaidiwang"),
    injectUrl: "https://www.9kd.com/create",
    injectFunction: ArticleKaiDiWang,
    tags: ["CN"],
    accountKey: "kaidiwang",
  },
  ARTICLE_AUTOHOME: {
    type: "ARTICLE",
    name: "ARTICLE_AUTOHOME",
    homeUrl: "https://www.autohome.com.cn/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/autohome.ico"),
    platformName: chrome.i18n.getMessage("platformAutohome"),
    injectUrl: "https://chejiahao.autohome.com.cn/article/post.html",
    injectFunction: ArticleAutohome,
    tags: ["CN"],
    accountKey: "autohome",
  },
  // experimental(待线上验证):Jianpian ARTICLE DOM 路径
  ARTICLE_JIANPIAN: {
    type: "ARTICLE",
    name: "ARTICLE_JIANPIAN",
    homeUrl: "https://www.jianpian.cn/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/jianpian.ico"),
    platformName: chrome.i18n.getMessage("platformJianpian"),
    injectUrl: "https://www.jianpian.cn/p/edit",
    injectFunction: ArticleJianpian,
    tags: ["CN"],
    accountKey: "jianpian",
  },
  // experimental(待线上验证):Tonghuashun ARTICLE DOM 路径
  ARTICLE_TONGHUASHUN: {
    type: "ARTICLE",
    name: "ARTICLE_TONGHUASHUN",
    homeUrl: "https://t.10jqka.com.cn/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/tonghuashun.ico"),
    platformName: chrome.i18n.getMessage("platformTonghuashun"),
    injectUrl: "https://t.10jqka.com.cn/newcircle/creation/postAll",
    injectFunction: ArticleTonghuashun,
    tags: ["CN"],
    accountKey: "tonghuashun",
  },
  // experimental(待线上验证):Dongchedi ARTICLE DOM 路径
  ARTICLE_DONGCHEDI: {
    type: "ARTICLE",
    name: "ARTICLE_DONGCHEDI",
    homeUrl: "https://mp.dcdapp.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/dongchedi.png"),
    platformName: chrome.i18n.getMessage("platformDongchedi"),
    injectUrl: "https://mp.dcdapp.com/profile_v2/publish/article",
    injectFunction: ArticleDongchedi,
    tags: ["CN"],
    accountKey: "dongchedi",
  },
  // experimental(待线上验证):Zsxq ARTICLE DOM 路径
  ARTICLE_ZSXQ: {
    type: "ARTICLE",
    name: "ARTICLE_ZSXQ",
    homeUrl: "https://wx.zsxq.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/zsxq.ico"),
    platformName: chrome.i18n.getMessage("platformZSXQ"),
    injectUrl: "https://wx.zsxq.com/",
    injectFunction: ArticleZsxq,
    tags: ["CN"],
    accountKey: "zsxq",
  },
  // experimental(待线上验证):163 DOM 路径,正文图片 CDN 重传需后续 API 化
  ARTICLE_NETEASE: {
    type: "ARTICLE",
    name: "ARTICLE_NETEASE",
    homeUrl: "https://mp.163.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/netease.png"),
    platformName: chrome.i18n.getMessage("platformNetease"),
    injectUrl: "https://mp.163.com/#/article-publish",
    injectFunction: ArticleNetease,
    tags: ["CN"],
    accountKey: "netease",
  },
  // experimental(待线上验证):Sohu ARTICLE DOM fallback 路径
  ARTICLE_SOHU: {
    type: "ARTICLE",
    name: "ARTICLE_SOHU",
    homeUrl: "https://mp.sohu.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/sohu.png"),
    platformName: chrome.i18n.getMessage("platformSohu"),
    injectUrl: "https://mp.sohu.com/mpfe/v4/contentManagement/news/addarticle",
    injectFunction: ArticleSohu,
    tags: ["CN"],
    accountKey: "sohu",
  },
  // experimental: Dayuhao ARTICLE DOM path
  ARTICLE_DAYUHAO: {
    type: "ARTICLE",
    name: "ARTICLE_DAYUHAO",
    homeUrl: "https://mp.dayu.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/dayu.ico"),
    platformName: chrome.i18n.getMessage("platformDayu"),
    injectUrl: "https://mp.dayu.com/dashboard/article/write",
    injectFunction: ArticleDaYuHao,
    tags: ["CN"],
    accountKey: "dayu",
  },
  // experimental(待线上验证):Dingduanhao ARTICLE DOM 路径
  ARTICLE_DINGDUANHAO: {
    type: "ARTICLE",
    name: "ARTICLE_DINGDUANHAO",
    homeUrl: "https://mp.topnews.cn/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/dingduanhao.png"),
    platformName: chrome.i18n.getMessage("platformDingduanhao"),
    injectUrl: "https://mp.topnews.cn/#/scriptWrite",
    injectFunction: ArticleDingduanhao,
    tags: ["CN"],
    accountKey: "dingduanhao",
  },
  // experimental(待线上验证):Kuaichuanhao ARTICLE DOM 路径
  ARTICLE_KUAICHUANHAO: {
    type: "ARTICLE",
    name: "ARTICLE_KUAICHUANHAO",
    homeUrl: "https://kuaichuan.360kuai.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/kuaichuanhao.png"),
    platformName: chrome.i18n.getMessage("platformKuaichuanhao"),
    injectUrl: "https://kuaichuan.360kuai.com/#/console/publish/article",
    injectFunction: ArticleKuaichuanhao,
    tags: ["CN"],
    accountKey: "kuaichuanhao",
  },
  // experimental(待线上验证):Yidianzixun ARTICLE DOM 路径
  ARTICLE_YIDIANZIXUN: {
    type: "ARTICLE",
    name: "ARTICLE_YIDIANZIXUN",
    homeUrl: "https://mp.yidianzixun.com/",
    faviconUrl: chrome.runtime.getURL("assets/platforms/yidian.ico"),
    platformName: chrome.i18n.getMessage("platformYidian"),
    injectUrl: "https://mp.yidianzixun.com/#/Writing/articleEditor",
    injectFunction: ArticleYidianzixun,
    tags: ["CN"],
    accountKey: "yidian",
  },
  // experimental(待线上验证):X Article DOM 路径
  ARTICLE_XARTICLE: {
    type: "ARTICLE",
    name: "ARTICLE_XARTICLE",
    homeUrl: "https://x.com/compose/articles",
    faviconUrl: chrome.runtime.getURL("assets/platforms/x.png"),
    platformName: chrome.i18n.getMessage("platformX"),
    injectUrl: "https://x.com/compose/articles",
    injectFunction: ArticleXArticle,
    tags: ["International"],
    accountKey: "x",
  },
};
