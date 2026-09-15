import { logger } from "~utils/logger";
import type { DynamicData, SyncData } from "../common";

export async function DynamicJuejin(data: SyncData) {
  logger.debug("Juejin Dynamic 函数被调用");

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
    const { content, images, tags } = data.data as DynamicData;

    // 等待页面加载
    await waitForElement("div[contenteditable='true']");

    // 填写内容
    const textarea = document.querySelector("div[contenteditable='true']") as HTMLDivElement;
    logger.debug("textarea", textarea);
    if (textarea) {
      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      });
      const tagSuffix = tags?.length ? ` ${tags.map((t) => `#${t}`).join(" ")}` : "";
      pasteEvent.clipboardData?.setData("text/plain", `${content || ""}${tagSuffix}`);
      textarea.dispatchEvent(pasteEvent);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // 上传图片
    if (images && images.length > 0) {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      logger.debug("fileInput", fileInput);

      if (fileInput) {
        const dataTransfer = new DataTransfer();
        for (let i = 0; i < images.length; i++) {
          if (i >= 9) {
            logger.debug("最多上传9张图片");
            break;
          }
          const fileData = images[i];
          if (!fileData.type.startsWith("image/")) {
            logger.debug("skip non-image file", fileData);
            continue;
          }
          logger.debug("try upload file", fileData);
          try {
            const response = await fetch(fileData.url);
            const arrayBuffer = await response.arrayBuffer();
            const file = new File([arrayBuffer], fileData.name, { type: fileData.type });
            dataTransfer.items.add(file);
          } catch (error) {
            logger.error("获取文件失败:", error);
          }
        }

        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        fileInput.dispatchEvent(new Event("input", { bubbles: true }));
        logger.debug("文件上传操作完成");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // 查找发布按钮
    if (data.isAutoPublish) {
      const buttons = document.querySelectorAll("button");
      logger.debug("buttons", buttons);
      const sendButton = Array.from(buttons).find((btn) => btn.textContent?.includes("发布"));
      logger.debug("sendButton", sendButton);
      if (sendButton) {
        logger.debug("自动发布：点击发布按钮");
        sendButton.click();
      } else {
        logger.debug("未找到'发送'按钮");
      }
    } else {
      logger.debug("帖子准备就绪，等待手动发布");
    }
  } catch (error) {
    logger.error("Juejin Dynamic 发布过程中出错:", error);
  }
}
