import type { ArticleData, DynamicData, FileData, PodcastData, SyncData, VideoData } from "./common";

/**
 * 发布前的内容处理（原 tabs/publish.tsx 的 processXxx 迁移到共享模块，
 * 去掉 React state 依赖）。侧边栏在确认发布时调用：把图片/封面等 blob URL
 * 重新打包为当前上下文可用的 blob URL，再交给 background 创建平台标签注入。
 */

async function processFile(file: FileData): Promise<FileData> {
  try {
    const response = await fetch(file.url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    return {
      ...file,
      url: blobUrl,
    };
  } catch (error) {
    console.error("处理文件时出错:", error, file.name);
    return file;
  }
}

export async function processArticle(data: SyncData): Promise<SyncData> {
  const { htmlContent, markdownContent, images, cover } = data.data as ArticleData;
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");
  const imgElements = Array.from(doc.getElementsByTagName("img")) as HTMLImageElement[];

  const processedImages: FileData[] = [];
  let processedHtmlContent = htmlContent;
  let processedMarkdownContent = markdownContent;
  let processedCoverImage: FileData | null = null;

  if (Array.isArray(imgElements) && imgElements.length > 0) {
    for (const img of imgElements) {
      try {
        const originalUrl = img.src;
        // 已经是 blob URL 的图片：无需重新下载，直接把原数据带回
        if (originalUrl.startsWith("blob:")) {
          const existing = images?.find((image) => image.url === originalUrl);
          if (existing) {
            processedImages.push(existing);
          }
          continue;
        }

        // 下载图片并创建 blob URL
        const response = await fetch(originalUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        // 替换 HTML 中的图片 URL
        img.src = blobUrl;
        processedImages.push({
          name: images?.find((image) => image.url === originalUrl)?.name || originalUrl.split("/").pop() || blobUrl,
          url: blobUrl,
          type: blob.type,
          size: blob.size,
        });

        // 替换 markdown 中的图片 URL
        const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const imgRegex = new RegExp(`!\\[.*?\\]\\(${escapedUrl}\\)`, "g");
        processedMarkdownContent = processedMarkdownContent.replace(imgRegex, (match) => {
          return match.replace(originalUrl, blobUrl);
        });
      } catch (error) {
        console.error("处理图片时出错:", error, img.src);
      }
    }
  }

  if (cover) {
    processedCoverImage = await processFile(cover);
  }

  processedHtmlContent = doc.documentElement.outerHTML;

  return {
    ...data,
    data: {
      ...data.data,
      htmlContent: processedHtmlContent,
      markdownContent: processedMarkdownContent,
      images: processedImages,
      cover: processedCoverImage || cover,
    },
  };
}

export async function processDynamic(data: SyncData): Promise<SyncData> {
  const { images = [], videos = [] } = data.data as DynamicData;

  const processedImages: FileData[] = [];
  const processedVideos: FileData[] = [];

  if (Array.isArray(images) && images.length > 0) {
    for (const image of images) {
      processedImages.push(await processFile(image));
    }
  } else {
    console.warn("images 不是一个数组或可迭代对象", images);
  }

  if (Array.isArray(videos) && videos.length > 0) {
    for (const video of videos) {
      processedVideos.push(await processFile(video));
    }
  } else {
    console.warn("videos 不是一个数组或可迭代对象", videos);
  }

  return {
    ...data,
    data: {
      ...data.data,
      images: processedImages,
      videos: processedVideos,
    },
  };
}

export async function processPodcast(data: SyncData): Promise<SyncData> {
  const { audio } = data.data as PodcastData;

  if (!audio) {
    console.warn("音频数据不存在");
    return data;
  }

  const processedAudio = await processFile(audio);
  return {
    ...data,
    data: {
      ...data.data,
      audio: processedAudio,
    },
  };
}

export async function processVideo(data: SyncData): Promise<SyncData> {
  const { video, cover, verticalCover, horizontalCover, scheduledPublishTime } = data.data as VideoData;

  if (!video) {
    console.warn("视频数据不存在");
    return data;
  }

  const processedVideo = await processFile(video);
  let processedCover: FileData | null = null;
  if (cover) {
    processedCover = await processFile(cover);
  }
  let processedVerticalCover: FileData | null = null;
  if (verticalCover) {
    processedVerticalCover = await processFile(verticalCover);
  }
  let processedHorizontalCover: FileData | null = null;
  if (horizontalCover) {
    processedHorizontalCover = await processFile(horizontalCover);
  }

  return {
    ...data,
    data: {
      ...data.data,
      video: processedVideo,
      cover: processedCover || cover,
      verticalCover: processedVerticalCover || verticalCover,
      horizontalCover: processedHorizontalCover || horizontalCover,
      scheduledPublishTime: scheduledPublishTime || 0,
    },
  };
}

/**
 * 根据所选平台类型对待发布数据做对应的内容处理（原发布进度窗口做的事）。
 */
export async function processContentForPublish(data: SyncData): Promise<SyncData> {
  let processedData = data;
  processedData.origin = data.data;

  if (data?.platforms.some((platform) => platform.name.includes("ARTICLE"))) {
    processedData = await processArticle(data);
  }
  if (data?.platforms.some((platform) => platform.name.includes("DYNAMIC"))) {
    processedData = await processDynamic(data);
  }
  if (data?.platforms.some((platform) => platform.name.includes("VIDEO"))) {
    processedData = await processVideo(data);
  }
  if (data?.platforms.some((platform) => platform.name.includes("PODCAST"))) {
    processedData = await processPodcast(data);
  }
  return processedData;
}
