import { logger } from "~utils/logger";
import type { DynamicData, SyncData } from "../common";

// 不支持发布视频
export async function DynamicToutiaohao(data: SyncData) {
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

    // 等待编辑器出现并输入内容
    await waitForElement('div[contenteditable="true"]');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const editor = document.querySelector('div[contenteditable="true"]') as HTMLDivElement;
    logger.debug("qlEditor", editor);
    if (!editor) {
      logger.debug("未找到编辑器元素");
      return;
    }

    const tagSuffix = tags?.length ? ` ${tags.map((t) => `#${t}#`).join(" ")}` : "";
    editor.innerText = `${content || ""}${tagSuffix}`;
    editor.focus();
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 移除已存在的图片
    const removeExistingImages = async () => {
      for (let i = 0; i < 20; i++) {
        const closeButton = document.querySelector(".image-remove-btn");
        if (!closeButton) break;
        logger.debug("Clicking close button", closeButton);
        (closeButton as HTMLElement).click();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    };

    await removeExistingImages();

    // 处理图片上传
    if (images?.length > 0) {
      const uploadButtons = document.querySelectorAll("button.syl-toolbar-button");
      const uploadButton = Array.from(uploadButtons).find((button) => button.textContent?.includes("图片"));

      if (uploadButton) {
        logger.debug("Found upload image button", uploadButton);
        uploadButton.dispatchEvent(new Event("click", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        logger.debug("fileInput", fileInput);

        if (!fileInput) {
          logger.debug("未找到文件输入元素");
          return;
        }

        const dataTransfer = new DataTransfer();
        for (const image of images || []) {
          if (!image.type.startsWith("image/")) {
            logger.debug("skip non-image file", image);
            continue;
          }
          logger.debug("try upload file", image);
          const response = await fetch(image.url);
          const arrayBuffer = await response.arrayBuffer();
          const file = new File([arrayBuffer], image.name, { type: image.type });
          dataTransfer.items.add(file);
          logger.debug("uploaded");
        }

        if (dataTransfer.files.length > 0) {
          fileInput.files = dataTransfer.files;
          fileInput.dispatchEvent(new Event("change", { bubbles: true }));
          fileInput.dispatchEvent(new Event("input", { bubbles: true }));
          logger.debug("文件上传操作完成");
        }

        await new Promise((resolve) => setTimeout(resolve, 5000));

        const confirmButton = document.querySelector('button[data-e2e="imageUploadConfirm-btn"]') as HTMLButtonElement;
        logger.debug("confirmButton", confirmButton);
        if (confirmButton) {
          logger.debug("Clicking confirm button for image upload");
          confirmButton.dispatchEvent(new Event("click", { bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          logger.debug("未找到图片上传确认按钮");
        }
      }
    }

    const publishButton = document.querySelector("button.publish-content") as HTMLButtonElement;
    logger.debug("sendButton", publishButton);

    if (publishButton) {
      if (data.isAutoPublish) {
        logger.debug("sendButton clicked");
        publishButton.dispatchEvent(new Event("click", { bubbles: true }));
      }
    } else {
      logger.debug("未找到'发送'按钮");
    }
  } catch (error) {
    logger.error("头条号发布过程中出错:", error);
  }
}
