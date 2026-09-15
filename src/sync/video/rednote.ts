import type { SyncData, VideoData } from "../common";

// 注意：injectFunction 会被 chrome.scripting.executeScript 序列化注入到目标页面，
// 闭包外的 import 不会随之带过去，所以发布按钮的查找逻辑必须就地声明，
// 不能依赖 ../dom-utils 等外部模块。

export async function VideoRednote(data: SyncData) {
  const { content, video, title, tags, cover, scheduledPublishTime } = data.data as VideoData;

  // 辅助函数：等待元素出现
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

  // 辅助函数：上传文件
  async function uploadVideo() {
    const fileInput = (await waitForElement('input[type="file"]')) as HTMLInputElement;
    if (!fileInput) {
      console.error("未找到文件输入元素");
      return;
    }

    const dataTransfer = new DataTransfer();

    if (video) {
      try {
        const response = await fetch(video.url);
        if (!response.ok) {
          throw new Error(`HTTP 错误! 状态: ${response.status}`);
        }
        const blob = await response.blob();
        const file = new File([blob], video.name, { type: video.type });
        dataTransfer.items.add(file);
      } catch (error) {
        console.error(`上传视频 ${video.url} 失败:`, error);
      }
    }

    if (dataTransfer.files.length > 0) {
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      fileInput.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待文件处理
      console.log("文件上传操作完成");
    } else {
      console.error("没有成功添加任何文件");
    }
  }

  /**
   * 设置定时发布时间
   * @param scheduledPublishTime - 定时发布时间戳（毫秒）
   */
  async function setScheduledPublishTime(scheduledPublishTime: number): Promise<void> {
    const labels = document.querySelectorAll("label");
    console.debug("labels -->", labels);

    const scheduledLabel = Array.from(labels).find((label) => label.textContent?.includes("定时发布"));
    console.debug("label -->", scheduledLabel);

    if (scheduledLabel) {
      (scheduledLabel as HTMLElement).click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const publishTimeInput = document.querySelector('input[placeholder="选择日期和时间"]') as HTMLInputElement;
    console.debug("publishTimeInput -->", publishTimeInput);

    if (publishTimeInput) {
      // 计算时间：添加 8 小时（28800000 毫秒）以调整时区
      const adjustedTime = new Date(scheduledPublishTime + 28800000);
      const formattedTime = adjustedTime.toISOString().slice(0, 16).replace("T", " ");

      publishTimeInput.focus();
      await new Promise((resolve) => setTimeout(resolve, 100));

      publishTimeInput.value = formattedTime;
      publishTimeInput.dispatchEvent(new Event("input", { bubbles: true }));
      publishTimeInput.dispatchEvent(new Event("change", { bubbles: true }));
      publishTimeInput.blur();

      console.debug("定时发布时间已设置:", formattedTime);
    }
  }

  // 辅助函数：上传封面
  async function uploadCover(coverFile: NonNullable<VideoData["cover"]>) {
    console.debug("tryCover", coverFile);
    const coverUploadTrigger = document.querySelector("div.noCover.uploadCover") as HTMLElement;
    console.debug("coverUpload", coverUploadTrigger);
    if (!coverUploadTrigger) {
      console.error("未找到封面上传触发器: div.noCover.uploadCover");
      return;
    }
    coverUploadTrigger.click();

    const fileInputSelector = "input[accept='image/png, image/jpeg, image/*']";
    try {
      await waitForElement(fileInputSelector);
    } catch (e) {
      console.error(`等待元素 ${fileInputSelector} 超时`, e);
      return;
    }

    const fileInput = document.querySelector(fileInputSelector) as HTMLInputElement;
    console.debug("fileInput", fileInput);
    if (!fileInput) {
      console.error("未找到封面上传的文件输入元素");
      return;
    }

    const dataTransfer = new DataTransfer();
    console.debug("try upload file", coverFile);
    if (!coverFile.type.includes("image/")) {
      console.error("提供的封面文件不是图片");
      return;
    }

    try {
      const response = await fetch(coverFile.url);
      const arrayBuffer = await response.arrayBuffer();
      const file = new File([arrayBuffer], coverFile.name, { type: coverFile.type });
      dataTransfer.items.add(file);
    } catch (error) {
      console.error(`上传封面 ${coverFile.url} 失败:`, error);
      return;
    }

    if (dataTransfer.files.length === 0) {
      return;
    }

    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    fileInput.dispatchEvent(new Event("input", { bubbles: true }));
    console.debug("文件上传操作触发");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const doneButtons = document.querySelectorAll("span");
    console.debug("doneButtons", doneButtons);
    const doneButton = Array.from(doneButtons).find((btn) => btn.textContent?.trim() === "确定");
    console.debug("doneButton", doneButton);
    if (doneButton) {
      (doneButton as HTMLElement).click();
    }
  }

  // 等待页面加载
  await waitForElement('span[class="title"]');
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 上传视频
  await uploadVideo();

  // 填写内容
  // 等待标题输入框出现
  await waitForElement('input[type="text"]');
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 填写标题
  const titleInput = document.querySelector('input[type="text"]') as HTMLInputElement;
  if (titleInput) {
    const finalTitle = title?.slice(0, 20) || content?.slice(0, 20) || "";
    titleInput.value = finalTitle;
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // 填写内容和标签
  const editor = document.querySelector('div[contenteditable="true"]') as HTMLElement;
  if (!editor) {
    console.error("未找到编辑器元素");
    return;
  }

  // 填写正文内容
  editor.focus();
  const contentPasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    clipboardData: new DataTransfer(),
  });
  contentPasteEvent.clipboardData.setData("text/plain", `${content}\n` || "");
  editor.dispatchEvent(contentPasteEvent);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  editor.blur();

  // 添加标签
  if (tags && tags.length > 0) {
    for (const tag of tags) {
      editor.focus();
      const tagPasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      });
      tagPasteEvent.clipboardData.setData("text/plain", `#${tag}`);
      editor.dispatchEvent(tagPasteEvent);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 模拟回车键按下以确认标签
      const enterEvent = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
      });
      editor.dispatchEvent(enterEvent);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // 上传封面
  if (cover) {
    await uploadCover(cover);
  }

  // 处理定时发布
  if (scheduledPublishTime) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await setScheduledPublishTime(scheduledPublishTime);
  }

  if (data.isAutoPublish === true) {
    // ---- 就地声明：发布按钮点击逻辑 ----
    // 小红书把「发布」按钮放在 <xhs-publish-btn> 的 closed shadow DOM 内，
    // ISOLATED world 无法通过 element.shadowRoot 访问。document_start 阶段有一个
    // MAIN world 脚本（src/contents/xhs-shadow-capture.ts）覆写了 attachShadow 并
    // 提供 postMessage 接口，这里通过 postMessage 请求它（MAIN world）点击按钮。
    const isDisabled = (button: HTMLElement): boolean => {
      const el = button as HTMLButtonElement;
      return el.disabled === true || button.getAttribute("aria-disabled") === "true";
    };

    // 直接点击普通 DOM 中的发布按钮（不含 closed shadow DOM）
    const tryDirectClick = (): boolean => {
      const match = (b: Element): boolean => {
        const text = b.textContent ?? "";
        return text.includes("发布") && !text.includes("定时");
      };
      const button = Array.from(document.querySelectorAll("button")).find(match) as HTMLElement | undefined;
      if (!button || isDisabled(button)) return false;
      button.click();
      button.dispatchEvent(new Event("click", { bubbles: true }));
      return true;
    };

    // 请求 MAIN world 捕获脚本点击 closed shadow DOM 内的发布按钮
    const requestMainWorldClick = (): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        const requestId = `xhs_pub_${Date.now()}_${Math.random()}`;
        const timer = setTimeout(() => {
          window.removeEventListener("message", handler);
          resolve(false);
        }, 3000);
        function handler(event: MessageEvent) {
          const data = event.data as { type?: string; requestId?: string; found?: boolean } | null;
          if (!data || data.type !== "XHS_CLICK_PUBLISH_RESULT" || data.requestId !== requestId) return;
          clearTimeout(timer);
          window.removeEventListener("message", handler);
          resolve(Boolean(data.found));
        }
        window.addEventListener("message", handler);
        window.postMessage({ type: "XHS_CLICK_PUBLISH", requestId }, "*");
      });

    // 轮询：普通 DOM 优先，再用 postMessage 请求 MAIN world；视频处理较慢，最多约 60s
    const start = Date.now();
    let published = false;
    while (Date.now() - start < 60000) {
      if (tryDirectClick()) {
        published = true;
        break;
      }
      if (await requestMainWorldClick()) {
        published = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (published) {
      console.debug("小红书视频：点击发布按钮");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      window.location.href = "https://creator.xiaohongshu.com/new/note-manager";
    } else {
      console.debug("小红书视频：未找到可用发布按钮，跳过自动发布");
    }
  }
}
