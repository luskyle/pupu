import { buildXhsContent, pickXhsTitle } from "~utils/rednote-text";
import type { DynamicData, SyncData } from "../common";

// 注意：injectFunction 会被 chrome.scripting.executeScript 序列化注入到目标页面，
// 闭包外的 import 不会随之带过去，所以发布按钮的查找逻辑必须就地声明，
// 不能依赖 ../dom-utils 等外部模块。

// 优先发布图文
export async function DynamicRednote(data: SyncData) {
  const { title, content, images, tags } = data.data as DynamicData;
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
  async function uploadImages() {
    const fileInput = (await waitForElement('input[type="file"]')) as HTMLInputElement;
    if (!fileInput) {
      console.error("未找到文件输入元素");
      return;
    }

    const dataTransfer = new DataTransfer();

    for (const fileInfo of images) {
      try {
        const response = await fetch(fileInfo.url);
        if (!response.ok) {
          throw new Error(`HTTP 错误! 状态: ${response.status}`);
        }
        const blob = await response.blob();
        const file = new File([blob], fileInfo.name, { type: fileInfo.type });
        dataTransfer.items.add(file);
      } catch (error) {
        console.error(`上传图片 ${fileInfo.url} 失败:`, error);
      }
    }

    if (dataTransfer.files.length > 0) {
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待文件处理
      console.log("文件上传操作完成");
    } else {
      console.error("没有成功添加任何文件");
    }
  }

  // 辅助函数：等待所有图片上传完成
  // 不靠固定时长/图片计数猜测，而是轮询 MAIN world 的"发布按钮是否可用"：
  // 小红书上传播完前「发布」按钮是禁用的，按钮可点即代表所有素材已就绪。
  async function waitForImagesUploaded(timeout = 120000): Promise<void> {
    // 轮询 MAIN world 检测图片上传状态（XHS_IS_UPLOAD_DONE），与发布按钮完全解耦，
    // 避免影响发布按钮点击；状态驱动，不靠固定时长/计数猜测。
    const requestUploadDone = (): Promise<boolean> =>
      new Promise((resolve) => {
        const requestId = `xhs_updone_${Date.now()}_${Math.random()}`;
        const timer = setTimeout(() => {
          window.removeEventListener("message", handler);
          resolve(false);
        }, 3000);
        function handler(event: MessageEvent) {
          const d = event.data as { type?: string; requestId?: string; done?: boolean } | null;
          if (!d || d.type !== "XHS_IS_UPLOAD_DONE_RESULT" || d.requestId !== requestId) return;
          clearTimeout(timer);
          window.removeEventListener("message", handler);
          resolve(Boolean(d.done));
        }
        window.addEventListener("message", handler);
        window.postMessage({ type: "XHS_IS_UPLOAD_DONE", requestId }, "*");
      });

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await requestUploadDone()) {
        console.log("所有图片上传已完成");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.warn("等待小红书图片上传完成超时，继续执行");
  }

  if (images && images.length > 0) {
    // 等待页面加载
    await waitForElement('span[class="title"]');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 点击上传图文按钮
    const uploadButtons = document.querySelectorAll('span[class="title"]');
    const uploadButton = Array.from(uploadButtons).find((element) =>
      element.textContent?.includes("上传图文"),
    ) as HTMLElement;

    if (!uploadButton) {
      console.error("未找到上传图文按钮");
      return;
    }

    uploadButton.click();
    uploadButton.dispatchEvent(new Event("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 上传文件
    await uploadImages();
    await waitForImagesUploaded();

    // 填写标题：优先 placeholder/aria 含"标题"的输入框，其次编辑区顶部的文本输入框，
    // 再尝试 contenteditable（小红书新版可能用 contenteditable 做标题）。
    // 找不到不中断流程；打印候选元素信息便于排查（控制台 [小红书标题] 日志）。
    const describe = (e: Element): string => {
      const r = e.getBoundingClientRect();
      const cls = (e.getAttribute("class") || "").slice(0, 40);
      return `${e.tagName.toLowerCase()} cls="${cls}" ph="${e.getAttribute("placeholder") || ""}" aria="${e.getAttribute("aria-label") || ""}" dph="${e.getAttribute("data-placeholder") || ""}" x=${Math.round(r.x)} y=${Math.round(r.top)} w=${Math.round(r.width)} h=${Math.round(r.height)}`;
    };

    // 读取 contenteditable 的 ::before 占位文字（小红书用 CSS 伪元素显示"填写标题…/输入正文…"）
    const beforeContent = (e: Element): string => {
      try {
        const c = getComputedStyle(e, "::before").content;
        return c && c !== "none" ? c.replace(/^"|"$/g, "") : "";
      } catch {
        return "";
      }
    };

    // 汇总元素占位文字（placeholder / data-placeholder / aria-label / ::before）
    const placeholderText = (e: Element): string =>
      (e.getAttribute("placeholder") || "") +
      (e.getAttribute("data-placeholder") || "") +
      (e.getAttribute("aria-label") || "") +
      beforeContent(e);

    const findTitleInput = (): HTMLElement | null => {
      // 1) input/textarea，占位含"标题"
      const inputTitle = Array.from(document.querySelectorAll<HTMLElement>("input, textarea")).find((e) =>
        /标题/.test(placeholderText(e)),
      );
      if (inputTitle) {
        console.log("[小红书标题] input 命中:", describe(inputTitle));
        return inputTitle;
      }

      // 2) contenteditable，占位含"标题"（::before 或 data-placeholder）
      const editableTitle = Array.from(
        document.querySelectorAll<HTMLElement>('[contenteditable="true"], [contenteditable="plaintext-only"]'),
      ).find((e) => e.getBoundingClientRect().width > 100 && /标题/.test(placeholderText(e)));
      if (editableTitle) {
        console.log("[小红书标题] contenteditable 命中:", describe(editableTitle));
        return editableTitle;
      }

      // 3) 所有 contenteditable，取高度最小的（标题通常单行，正文多行）
      const editables = Array.from(
        document.querySelectorAll<HTMLElement>('[contenteditable="true"], [contenteditable="plaintext-only"]'),
      ).filter((e) => e.getBoundingClientRect().width > 100);
      if (editables.length > 0) {
        console.log("[小红书标题] contenteditable fallback:", editables.map(describe));
        editables.sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height);
        return editables[0];
      }

      // 4) 可见文本输入框，取最上方
      const visibleInputs = Array.from(
        document.querySelectorAll<HTMLElement>('input[type="text"], input:not([type]), input[type="search"]'),
      ).filter((e) => e.getBoundingClientRect().width > 40);
      if (visibleInputs.length > 0) {
        console.log("[小红书标题] 可见文本输入框:", visibleInputs.map(describe));
        visibleInputs.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        return visibleInputs[0];
      }
      return null;
    };

    const waitForTitle = (timeout = 30000): Promise<HTMLElement | null> => {
      const start = Date.now();
      return new Promise((resolve) => {
        const check = () => {
          const el = findTitleInput();
          if (el) {
            resolve(el);
            return;
          }
          if (Date.now() - start > timeout) {
            resolve(null);
            return;
          }
          setTimeout(check, 500);
        };
        check();
      });
    };

    // 通用填充：input 赋值 + 事件；contenteditable 用 execCommand（富文本编辑器更易识别）
    const setEditableText = (el: HTMLElement, text: string): void => {
      el.focus();
      if (el.isContentEditable) {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        sel?.removeAllRanges();
        sel?.addRange(range);
        document.execCommand("delete");
        document.execCommand("insertText", false, text);
      } else {
        const input = el as HTMLInputElement;
        input.value = text;
      }
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
      el.dispatchEvent(new InputEvent("change", { bubbles: true }));
    };

    // 小红书话题格式 / 标题长度规则见 ~utils/rednote-text（纯函数，已有单测覆盖）
    const titleText = pickXhsTitle(title, content);
    const contentText = buildXhsContent(content, tags);

    // 标题/正文很可能在 closed shadow DOM 内（isolated world 的 querySelector 访问不到），
    // 优先请求 MAIN world 捕获脚本（xhs-shadow-capture）填充；超时再回退 light DOM。
    const requestFillEditor = (): Promise<{ titleFilled: boolean; contentFilled: boolean }> =>
      new Promise((resolve) => {
        const requestId = `xhs_fill_${Date.now()}_${Math.random()}`;
        const timer = setTimeout(() => {
          window.removeEventListener("message", handler);
          resolve({ titleFilled: false, contentFilled: false });
        }, 5000);
        function handler(event: MessageEvent) {
          const d = event.data as {
            type?: string;
            requestId?: string;
            titleFilled?: boolean;
            contentFilled?: boolean;
          } | null;
          if (!d || d.type !== "XHS_FILL_EDITOR_RESULT" || d.requestId !== requestId) return;
          clearTimeout(timer);
          window.removeEventListener("message", handler);
          resolve({ titleFilled: Boolean(d.titleFilled), contentFilled: Boolean(d.contentFilled) });
        }
        window.addEventListener("message", handler);
        window.postMessage({ type: "XHS_FILL_EDITOR", requestId, title: titleText, content: contentText }, "*");
      });

    const fillResult = await requestFillEditor();
    console.log("小红书填充结果:", fillResult);

    // fallback：MAIN world 未响应/未命中时，用 light DOM 兜底
    if (!fillResult.titleFilled) {
      const titleEl = await waitForTitle();
      if (titleEl) {
        setEditableText(titleEl, titleText);
        console.log("已填写标题(light):", titleText);
      } else {
        console.warn("未找到标题输入框，跳过填写标题");
      }
    }
    if (!fillResult.contentFilled) {
      const contentCandidates = Array.from(
        document.querySelectorAll<HTMLElement>('[contenteditable="true"], [contenteditable="plaintext-only"]'),
      ).filter((e) => e.getBoundingClientRect().width > 100);
      const contentEditor: HTMLElement | null =
        contentCandidates.find((e) => /正文|描述|正文描述/.test(placeholderText(e))) || contentCandidates[0] || null;
      if (contentEditor) {
        setEditableText(contentEditor, contentText);
        console.log("设置内容(light):", content);
      } else {
        console.warn("未找到内容编辑器，跳过填写内容");
      }
    }

    // 自动发布
    if (data.isAutoPublish) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

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

      // 轮询：普通 DOM 优先，再用 postMessage 请求 MAIN world；避免素材上传后页面重渲染
      const start = Date.now();
      let published = false;
      while (Date.now() - start < 45000) {
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
        console.log("点击发布按钮");
        await new Promise((resolve) => setTimeout(resolve, 10000));
        window.location.href = "https://creator.xiaohongshu.com/new/note-manager";
      } else {
        console.error("[小红书图文] 未找到可用的发布按钮，跳过自动发布");
      }
    }
  }
}
