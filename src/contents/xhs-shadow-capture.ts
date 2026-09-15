import type { PlasmoCSConfig } from "plasmo";

/**
 * 小红书创作平台：捕获 closed shadow DOM 的发布按钮。
 *
 * 小红书发布页把「发布」按钮放在 <xhs-publish-btn> 的 **closed** shadow DOM 内
 * （shadowrootmode="closed"），外部 JS 无法通过 element.shadowRoot 访问。
 *
 * 本脚本在 MAIN world、document_start 时覆写 Element.prototype.attachShadow，
 * 把页面之后创建的所有 shadow root（含 closed）登记到 window.__xhsShadowRoots。
 * 自动发布脚本（chrome.scripting.executeScript 以 MAIN world 注入）即可遍历该
 * 注册表找到「发布」按钮并点击。
 */
export const config: PlasmoCSConfig = {
  matches: ["https://creator.xiaohongshu.com/*"],
  world: "MAIN",
  run_at: "document_start",
  all_frames: true,
};

declare global {
  interface Window {
    __xhsShadowRoots?: Set<ShadowRoot>;
  }
}

// 避免扩展热重载时重复覆写
if (typeof window !== "undefined" && !window.__xhsShadowRoots) {
  const registry = new Set<ShadowRoot>();
  window.__xhsShadowRoots = registry;

  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function attachShadowPatched(init?: ShadowRootInit): ShadowRoot {
    const shadowRoot = originalAttachShadow.call(this, init);
    if (shadowRoot) {
      registry.add(shadowRoot);
    }
    return shadowRoot;
  };

  // 查找（含 closed shadow DOM）并点击「发布」按钮，排除“定时发布”。
  const findPublishButton = (): HTMLElement | null => {
    const match = (b: Element): boolean => {
      const text = b.textContent ?? "";
      return text.includes("发布") && !text.includes("定时");
    };
    const searchRoot = (root: Document | ShadowRoot): HTMLElement | null => {
      const direct = Array.from(root.querySelectorAll("button")).find(match);
      if (direct) return direct as HTMLElement;
      for (const el of Array.from(root.querySelectorAll("*"))) {
        if (el.shadowRoot) {
          const nested = searchRoot(el.shadowRoot);
          if (nested) return nested;
        }
      }
      return null;
    };
    const fromDocument = searchRoot(document);
    if (fromDocument) return fromDocument;
    for (const shadowRoot of registry) {
      const fromShadow = searchRoot(shadowRoot);
      if (fromShadow) return fromShadow;
    }
    return null;
  };

  const clickPublish = (): { found: boolean; clicked: boolean; disabled: boolean } => {
    const button = findPublishButton();
    if (!button) return { found: false, clicked: false, disabled: false };
    const isDisabled =
      (button as HTMLButtonElement).disabled === true || button.getAttribute("aria-disabled") === "true";
    if (isDisabled) return { found: true, clicked: false, disabled: true };
    // 组合多种事件，提升对富组件的触发率
    button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    button.click();
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return { found: true, clicked: true, disabled: false };
  };

  // ISOLATED world 的发布脚本通过 postMessage 请求这里（MAIN world）点击发布按钮。
  // 跨 world 的 window 是同一个 DOM window，postMessage 事件可双向派发。
  window.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: string; requestId?: string } | null;
    if (!data || data.type !== "XHS_CLICK_PUBLISH" || typeof data.requestId !== "string") {
      return;
    }
    const result = clickPublish();
    console.log(
      "[xhs-shadow] 点击发布按钮结果:",
      result,
      result.found
        ? `元素=${(() => {
            const b = findPublishButton();
            return b ? `${b.tagName} "${(b.textContent || "").trim()}" class="${b.getAttribute("class") || ""}"` : "?";
          })()}`
        : `shadowRoots=${registry.size}`,
    );
    // found 用 result.found（找到按钮即算处理，宽松重试；保留日志便于排查）
    window.postMessage({ type: "XHS_CLICK_PUBLISH_RESULT", requestId: data.requestId, found: result.found }, "*");
  });

  // ---- 填充标题/正文（遍历 light DOM + 所有 closed shadow root）----
  // 小红书把标题框 <input class="d-text">、正文编辑器也放在 closed shadow DOM 内，
  // isolated world 的 document.querySelector 访问不到，这里在 MAIN world 统一处理。
  const collectRoots = (): (Document | ShadowRoot)[] => {
    const roots: (Document | ShadowRoot)[] = [document];
    const seen = new Set<ShadowRoot>();
    const walk = (root: Document | ShadowRoot) => {
      for (const el of Array.from(root.querySelectorAll("*"))) {
        if (el.shadowRoot && !seen.has(el.shadowRoot)) {
          seen.add(el.shadowRoot);
          roots.push(el.shadowRoot);
          walk(el.shadowRoot);
        }
      }
    };
    walk(document);
    for (const sr of registry) {
      if (!seen.has(sr)) {
        seen.add(sr);
        roots.push(sr);
        walk(sr);
      }
    }
    return roots;
  };

  // 汇总元素占位文字（placeholder / data-placeholder / aria-label / ::before）
  const placeholderOf = (el: Element): string => {
    try {
      const c = getComputedStyle(el, "::before").content;
      return (
        (el.getAttribute("placeholder") || "") +
        (el.getAttribute("data-placeholder") || "") +
        (el.getAttribute("aria-label") || "") +
        (c && c !== "none" ? c.replace(/^"|"$/g, "") : "")
      );
    } catch {
      return (el.getAttribute("placeholder") || "") + (el.getAttribute("data-placeholder") || "");
    }
  };

  const fillEditor = (opts: { title?: string; content?: string }): { titleFilled: boolean; contentFilled: boolean } => {
    const roots = collectRoots();
    let titleFilled = false;
    let contentFilled = false;

    if (opts.title) {
      for (const root of roots) {
        const candidates = Array.from(root.querySelectorAll<HTMLInputElement>("input, textarea")).filter(
          (e) => e.getBoundingClientRect().width > 20,
        );
        const titleInput =
          candidates.find((e) => e.classList?.contains("d-text")) ||
          candidates.find((e) => /标题|title/.test(e.getAttribute("placeholder") || "")) ||
          null;
        if (titleInput) {
          titleInput.focus();
          titleInput.value = opts.title;
          titleInput.dispatchEvent(new Event("input", { bubbles: true }));
          titleInput.dispatchEvent(new Event("change", { bubbles: true }));
          titleFilled = true;
          break;
        }
      }
    }

    if (opts.content) {
      for (const root of roots) {
        const editors = Array.from(
          root.querySelectorAll<HTMLElement>('[contenteditable="true"], [contenteditable="plaintext-only"]'),
        ).filter((e) => e.getBoundingClientRect().width > 100);
        const editor =
          editors.find((e) => /正文|描述/.test(placeholderOf(e))) ||
          editors.find((e) => !/标题/.test(placeholderOf(e))) ||
          null;
        if (editor) {
          editor.focus();
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          sel?.removeAllRanges();
          sel?.addRange(range);
          document.execCommand("delete");
          document.execCommand("insertText", false, opts.content);
          editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: opts.content }));
          contentFilled = true;
          break;
        }
      }
    }

    return { titleFilled, contentFilled };
  };

  window.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: string; requestId?: string; title?: string; content?: string } | null;
    if (!data || data.type !== "XHS_FILL_EDITOR" || typeof data.requestId !== "string") {
      return;
    }
    const result = fillEditor({ title: data.title, content: data.content });
    window.postMessage({ type: "XHS_FILL_EDITOR_RESULT", requestId: data.requestId, ...result }, "*");
  });

  // ---- 检测图片上传是否完成（与发布按钮完全解耦）----
  // 遍历所有 root（含 closed shadow DOM）：无"上传中"指示（loading/进度/百分比），
  // 且已出现就绪的图片缩略图 = 上传完成。不依赖发布按钮，避免影响发布按钮点击。
  const isUploadDone = (): boolean => {
    for (const root of collectRoots()) {
      const uploading = root.querySelector(
        '[class*="uploading" i], [class*="upload-progress"], [class*="UploadProgress"], [class*="loading" i], [class*="Loading"], [class*="percent" i]',
      );
      if (uploading) return false;
    }
    for (const root of collectRoots()) {
      for (const img of Array.from(root.querySelectorAll<HTMLImageElement>("img"))) {
        if (img.naturalWidth > 0 && img.getBoundingClientRect().width > 30) {
          return true;
        }
      }
    }
    return false;
  };

  window.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: string; requestId?: string } | null;
    if (!data || data.type !== "XHS_IS_UPLOAD_DONE" || typeof data.requestId !== "string") {
      return;
    }
    window.postMessage({ type: "XHS_IS_UPLOAD_DONE_RESULT", requestId: data.requestId, done: isUploadDone() }, "*");
  });
}
