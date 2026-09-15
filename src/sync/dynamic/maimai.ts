import { escapeHtml } from "~utils/escape-html";
import { logger } from "~utils/logger";
import type { DynamicData, SyncData } from "../common";

export async function DynamicMaimai(data: SyncData) {
  logger.debug("Maimai 函数被调用");

  function waitForElement(selector: string, timeout = 10000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element with selector "${selector}" not found within ${timeout}ms`));
      }, timeout);
    });
  }

  try {
    const { title, content, images, videos, tags } = data.data as DynamicData;

    // 等待页面加载
    await waitForElement("div[contenteditable]");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 填写标题（可选）
    const titleInput = document.querySelector("input[placeholder='输入标题会更受欢迎（选填）']") as HTMLInputElement;
    logger.debug("titleInput", titleInput);
    if (titleInput && title) {
      titleInput.value = title;
      titleInput.dispatchEvent(new Event("input", { bubbles: true }));
      titleInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // 填写内容
    const editor = document.querySelector("div[contenteditable]") as HTMLDivElement;
    logger.debug("qlEditor", editor);
    if (!editor) {
      logger.debug("未找到编辑器元素");
      return;
    }

    // 正文与话题都是用户输入：先转义再拼自建的 <br>，否则含 < > 的文本会被编辑器当成标签吞掉
    const tagSuffix = tags?.length ? ` ${tags.map((t) => `#${escapeHtml(t)}`).join(" ")}` : "";
    const htmlContent = `${escapeHtml(content || "").replace(/\n/g, "<br>")}${tagSuffix}`;
    editor.innerHTML = htmlContent;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));

    // 上传媒体文件
    const mediaFiles = [...(images || []), ...(videos || [])];
    if (mediaFiles.length > 0) {
      // 检查是否有视频，如果有视频只上传第一个视频
      const hasVideo = mediaFiles.some((file) => file.type.startsWith("video/"));
      let filesToUpload = mediaFiles;
      if (hasVideo) {
        const videoFile = mediaFiles.find((file) => file.type.startsWith("video/"));
        if (videoFile) {
          filesToUpload = [videoFile];
        }
      }

      // 根据类型选择不同的 input
      const fileInput = document.querySelector(
        hasVideo ? 'input[type="file"][id="video"]' : 'input[type="file"][id="picture"]',
      ) as HTMLInputElement;

      if (!fileInput) {
        logger.debug("未找到文件输入元素");
        return;
      }

      const dataTransfer = new DataTransfer();
      for (let i = 0; i < filesToUpload.length; i++) {
        if (i >= 9) {
          logger.debug("最多上传9张图片");
          break;
        }
        const fileData = filesToUpload[i];
        logger.debug("try upload file", fileData);
        try {
          const response = await fetch(fileData.url);
          const arrayBuffer = await response.arrayBuffer();
          const file = new File([arrayBuffer], fileData.name, { type: fileData.type });
          dataTransfer.items.add(file);
          logger.debug("uploaded");
        } catch (error) {
          logger.error("获取文件失败:", error);
        }
      }

      if (dataTransfer.files.length > 0) {
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        fileInput.dispatchEvent(new Event("input", { bubbles: true }));
        logger.debug("文件上传操作完成");
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 查找发布按钮
    const buttons = document.querySelectorAll("button");
    const sendButton = Array.from(buttons).find((btn) => btn.textContent?.includes("发动态")) as HTMLButtonElement;
    logger.debug("sendButton", sendButton);

    if (sendButton) {
      if (data.isAutoPublish) {
        logger.debug("自动发布：点击发布按钮");
        sendButton.dispatchEvent(new Event("click", { bubbles: true }));
      } else {
        logger.debug("帖子准备就绪，等待手动发布");
      }
    } else {
      logger.debug("未找到'发送'按钮");
    }
  } catch (error) {
    logger.error("Maimai 发布过程中出错:", error);
  }
}
