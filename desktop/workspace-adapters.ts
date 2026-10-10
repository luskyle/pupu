import { ArticleInfoMap } from "../src/sync/article";
import { DynamicInfoMap } from "../src/sync/dynamic";
import { VideoInfoMap } from "../src/sync/video";

export const platforms = { ...DynamicInfoMap, ...VideoInfoMap, ...ArticleInfoMap };
export { logger } from "../src/utils/logger";
