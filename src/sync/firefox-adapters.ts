import { prepareFirefoxMedia } from "~utils/firefox-media";
import { ArticleInfoMap } from "./article";
import { DynamicInfoMap } from "./dynamic";
import { PodcastInfoMap } from "./podcast";
import { VideoInfoMap } from "./video";

const platforms = { ...DynamicInfoMap, ...ArticleInfoMap, ...VideoInfoMap, ...PodcastInfoMap };

globalThis.__pupuRunFirefoxAdapter = async (name, data) => {
  if (!Object.hasOwn(platforms, name)) throw new Error(`未找到平台适配器：${name}`);
  await prepareFirefoxMedia(data);
  await platforms[name].injectFunction(data);
};
