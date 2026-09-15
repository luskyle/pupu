import { logger } from "~utils/logger";
import type { SyncData, VideoData } from "../common";

export async function VideoWeibo(data: SyncData) {
  const { content, video, title, tags, cover } = data.data as VideoData;

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

  function simulateDragAndDrop(dropTarget: Element, dataTransfer: DataTransfer) {
    const dragEnter = new DragEvent("dragenter", { bubbles: true, dataTransfer });
    const dragOver = new DragEvent("dragover", { bubbles: true, dataTransfer });
    const drop = new DragEvent("drop", { bubbles: true, dataTransfer });

    dropTarget.dispatchEvent(dragEnter);
    dropTarget.dispatchEvent(dragOver);
    dropTarget.dispatchEvent(drop);
  }

  /**
   * 等待视频上传真正完成（而非固定等待），避免上传还没成功就进入后续的发布流程。
   * 通过轮询页面中出现的"上传完成/成功"等标记判断；检测到上传失败或长时间无结果
   * 则抛错。兜底：若"发布"按钮已可点击（说明上传及后续处理已完成），同样视为完成。
   */
  function waitForUploadCompletion(timeout = 300000): Promise<void> {
    const completeKeywords = ["上传完成", "上传成功", "上传完毕", "视频上传完成", "视频上传成功"];
    const failedKeywords = ["上传失败", "上传出错", "上传错误"];
    const hasAnyText = (keywords: string[]) =>
      Array.from(document.querySelectorAll<HTMLElement>("span, div, p, li, em, h1, h2, h3")).some((el) => {
        const text = el.textContent || "";
        return keywords.some((k) => text.includes(k));
      });

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        if (hasAnyText(failedKeywords)) {
          reject(new Error("视频上传失败"));
          return;
        }
        if (hasAnyText(completeKeywords)) {
          logger.debug("视频上传完成");
          resolve();
          return;
        }
        // 兜底：发布按钮可用说明上传及后续处理已完成
        const sendButton = Array.from(document.querySelectorAll("button")).find((button) =>
          button.textContent?.includes("发布"),
        ) as HTMLButtonElement | undefined;
        if (sendButton && !sendButton.disabled) {
          logger.debug("发布按钮已可用，视为上传完成");
          resolve();
          return;
        }
        if (Date.now() - startTime > timeout) {
          reject(new Error("等待视频上传完成超时"));
          return;
        }
        setTimeout(check, 1000);
      };
      setTimeout(check, 500);
    });
  }

  try {
    // 等待文件上传按钮出现
    await waitForElement('input[type="file"]');

    // 处理视频上传
    if (video) {
      const response = await fetch(video.url);
      const arrayBuffer = await response.arrayBuffer();
      const videoFile = new File([arrayBuffer], video.name, { type: video.type });
      logger.debug(`文件: ${videoFile.name} ${videoFile.type} ${videoFile.size}`);

      // 优先选择接受视频格式的文件输入框，回退到页面第一个文件输入框
      const fileInput =
        Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]')).find((input) =>
          /video|mp4|mov|mkv|avi/.test((input.accept || "").toLowerCase()),
        ) ?? (document.querySelector('input[type="file"]') as HTMLInputElement | null);

      if (fileInput) {
        // 直接设置文件并触发 change/input（比模拟拖拽更可靠，拖拽事件可能不被页面框架识别）
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(videoFile);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        fileInput.dispatchEvent(new Event("input", { bubbles: true }));
        logger.debug("已通过文件输入框触发视频上传");
      } else {
        // 兜底：找不到文件输入框时，回退到"上传视频"按钮区域拖拽上传
        const uploadVideoButton = Array.from(document.querySelectorAll("button")).find((button) =>
          button.textContent?.includes("上传视频"),
        );
        const dragArea = uploadVideoButton?.parentElement?.parentElement;
        if (!uploadVideoButton || !dragArea) {
          throw new Error("未找到视频上传入口");
        }
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(videoFile);
        simulateDragAndDrop(dragArea, dataTransfer);
        logger.debug("已通过拖拽触发视频上传");
      }

      // 等待视频上传真正完成（而非固定等待），避免上传未完成就进入发布流程
      await waitForUploadCompletion();
    }

    // 等待标题输入框出现
    await waitForElement('input[placeholder="填写标题（0～30个字）"]');

    // 等待验证码消失
    while (true) {
      const geetest = document.querySelector("div.geetest_captcha.geetest_boxShow.geetest_freeze_wait");
      if (!geetest) break;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    // 点击原创选项
    const radioTexts = document.querySelectorAll("span.woo-radio-text");
    const originalSpan = Array.from(radioTexts).find((span) => span.textContent === "原创");
    if (originalSpan) {
      (originalSpan as HTMLElement).click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 填写标题
    const titleInput = document.querySelector('input[placeholder="填写标题（0～30个字）"]') as HTMLInputElement;
    if (titleInput) {
      titleInput.value = title;
      titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // 填写内容
    const descriptionInput = document.querySelector(
      'textarea[placeholder="有什么新鲜事想分享给大家？"]',
    ) as HTMLTextAreaElement;
    if (descriptionInput) {
      const tagsText = tags ? tags.map((tag) => `#${tag}#`).join(" ") : "";
      const fullContent = `${content} ${tagsText}`;

      descriptionInput.focus();
      descriptionInput.value = fullContent;
      descriptionInput.dispatchEvent(new Event("input", { bubbles: true }));
      descriptionInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    async function uploadCover(coverData: { url: string; name: string; type?: string }) {
      logger.debug("tryCover", coverData);
      const cropCoverLink = Array.from(document.querySelectorAll("a")).find((e) => e.textContent?.includes("裁剪封面"));

      logger.debug("a", cropCoverLink);
      if (!cropCoverLink) return;

      (cropCoverLink as HTMLElement).click();
      await new Promise((e) => setTimeout(e, 1000));

      const fileInput = document.querySelector<HTMLInputElement>(
        "input[type='file'][accept='.jpg, .jpeg, .bmp, .gif, .png']",
      );
      logger.debug("fileInput", fileInput);
      if (!fileInput) return;

      const dataTransfer = new DataTransfer();

      logger.debug("try upload file", coverData);
      if (!coverData.type || !coverData.type.includes("image/")) {
        return;
      }

      const response = await fetch(coverData.url);
      const arrayBuffer = await response.arrayBuffer();
      const imageFile = new File([arrayBuffer], coverData.name, { type: coverData.type });
      dataTransfer.items.add(imageFile);

      if (dataTransfer.files.length === 0) return;

      fileInput.files = dataTransfer.files;
      const changeEvent = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(changeEvent);
      const inputEvent = new Event("input", { bubbles: true });
      fileInput.dispatchEvent(inputEvent);

      logger.debug("文件上传操作触发");
      await new Promise((e) => setTimeout(e, 3000));

      const tab1 = document.querySelector("div.wbpro-tab1");
      logger.debug("tab1", tab1);
      if (!tab1) return;

      const doneButtonsContainer = tab1.nextElementSibling;
      if (!doneButtonsContainer) return;

      const doneButtons = doneButtonsContainer.querySelectorAll(
        "div.wbpro-layer div.wbpro-layer-btn.woo-box-flex.woo-box-justifyCenter button",
      );
      logger.debug("doneButtons", doneButtons);

      const doneButton = Array.from(doneButtons).find((e) => "完成" === e.textContent);
      logger.debug("doneButton", doneButton);
      if (doneButton) {
        (doneButton as HTMLElement).click();
      }
    }

    if (cover) {
      await uploadCover(cover);
    }

    // 处理自动发布
    if (data.isAutoPublish) {
      const buttons = document.querySelectorAll("button");
      const sendButton = Array.from(buttons).find((button) =>
        button.textContent?.includes("发布"),
      ) as HTMLButtonElement;

      if (sendButton) {
        let attempts = 0;
        while (sendButton.disabled && attempts < 10) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          attempts++;
          logger.debug(`等待发布按钮启用中... 尝试 ${attempts}/10`);
        }

        if (sendButton.disabled) {
          throw new Error("发布按钮在10次尝试后仍然禁用");
        }

        logger.debug("点击发布按钮");
        sendButton.dispatchEvent(new Event("click", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 3000));
        window.location.reload();
      } else {
        logger.debug('未找到"发布"按钮');
      }
    }
  } catch (error) {
    logger.error("填入微博内容或上传视频时出错:", error);
  }
}
