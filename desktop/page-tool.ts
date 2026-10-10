export interface PageCandidate {
  id: string;
  kind: "input" | "textarea" | "contenteditable";
  label: string;
  placeholder: string;
}

export interface PageObservation {
  observationId: string;
  url: string;
  candidates: PageCandidate[];
  bodyId: string | null;
}

export type PageAction = "observe" | "fill" | "read" | "publishState" | "prepareImages" | "submit";
export interface PublishState {
  submitReady: boolean;
  blocked: boolean;
  success: boolean;
  selectedImages?: number;
}

type ToolArgs = {
  observationId?: string;
  id?: string;
  text?: string;
  expectedTitle?: string;
  bodyId?: string | null;
  expectedContent?: string;
};

// This function is serialized into Chromium's isolated world; keep it self-contained.
export function pageTool(action: PageAction, args: ToolArgs = {}, additionalRoots: ShadowRoot[] = []) {
  type State = {
    observationId: string;
    url: string;
    elements: HTMLElement[];
    candidates: PageCandidate[];
    written: Record<string, string>;
    containers: (Document | ShadowRoot)[];
  };
  const scope = globalThis as typeof globalThis & { __pupuDesktopObservation?: State };
  const metadata = (element: HTMLElement, id: string): PageCandidate => ({
    id,
    kind:
      element instanceof HTMLInputElement
        ? "input"
        : element instanceof HTMLTextAreaElement
          ? "textarea"
          : "contenteditable",
    label: (
      element.getAttribute("aria-label") ||
      (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
        ? Array.from(element.labels || [])
            .map((label) => label.textContent || "")
            .join(" ")
        : "")
    ).slice(0, 120),
    placeholder: (
      element.getAttribute("placeholder") ||
      element.getAttribute("data-placeholder") ||
      element.querySelector("[data-placeholder]")?.getAttribute("data-placeholder") ||
      ""
    ).slice(0, 120),
  });
  const usable = (element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      element.isConnected &&
      rect.width > 20 &&
      rect.height > 0 &&
      style.visibility === "visible" &&
      style.display !== "none" &&
      !(element instanceof HTMLInputElement && element.type !== "text") &&
      !element.matches(':disabled, [readonly], [aria-disabled="true"]') &&
      !element.closest('[inert], [aria-hidden="true"], nav, [role="dialog"]')
    );
  };
  const read = (element: HTMLElement): string =>
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? element.value
      : element.textContent || "";
  const unchanged = (state: State, element: HTMLElement, index: number): boolean => {
    const original = state.candidates[index];
    const current = metadata(element, original.id);
    if (JSON.stringify(current) === JSON.stringify(original)) return true;
    // Rich editors remove their empty-paragraph placeholder after insertion.
    // Accept only this transition on the same node with our exact written text.
    return (
      original.kind === current.kind &&
      original.label === current.label &&
      Boolean(original.placeholder) &&
      current.placeholder === "" &&
      Object.hasOwn(state.written, original.id) &&
      read(element) === state.written[original.id]
    );
  };
  const resolve = (state: State, index: number): HTMLElement | undefined => {
    const original = state.elements[index];
    if (!original || original.isConnected) return original;
    const candidate = state.candidates[index];
    if (!Object.hasOwn(state.written, candidate.id) || (!candidate.label && !candidate.placeholder)) return original;
    // Rebind only a uniquely identified replacement with the exact text we wrote,
    // in the same document/shadow root. Never refill a replacement automatically.
    const replacements = Array.from(
      state.containers[index].querySelectorAll<HTMLElement>(
        'input[type="text"], input:not([type]), textarea, [contenteditable="true"], [contenteditable="plaintext-only"]',
      ),
    ).filter(
      (element) => usable(element) && unchanged(state, element, index) && read(element) === state.written[candidate.id],
    );
    if (replacements.length !== 1) return original;
    state.elements[index] = replacements[0];
    return replacements[0];
  };
  const roots: (Document | ShadowRoot)[] = [document, ...additionalRoots.filter((root) => root.host.isConnected)];
  const seen = new Set<Document | ShadowRoot>(roots);
  for (let i = 0; i < roots.length; i++) {
    for (const element of roots[i].querySelectorAll("*")) {
      if (element.shadowRoot && !seen.has(element.shadowRoot)) {
        roots.push(element.shadowRoot);
        seen.add(element.shadowRoot);
      }
    }
  }
  const ancestors = (element: HTMLElement): HTMLElement[] => {
    const chain: HTMLElement[] = [];
    let current: HTMLElement | null = element;
    while (current) {
      chain.push(current);
      const root = current.getRootNode();
      current = current.parentElement || (root instanceof ShadowRoot ? (root.host as HTMLElement) : null);
    }
    return chain;
  };
  const visible = (element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect();
    return (
      element.isConnected &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.top < window.innerHeight &&
      ancestors(element).every((parent) => {
        const style = getComputedStyle(parent);
        return (
          !parent.matches('[hidden], [inert], [aria-hidden="true"]') &&
          style.visibility !== "hidden" &&
          style.visibility !== "collapse" &&
          style.display !== "none" &&
          (!style.opacity || Number(style.opacity) >= 0.01)
        );
      })
    );
  };
  const buttons = roots
    .flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>('button, [role="button"]')))
    .filter(visible);
  const publishButtons = buttons.filter((button) =>
    /^(发布|发布笔记|立即发布|确认发布)$/.test((button.textContent || "").trim()),
  );
  const enabled = (element: HTMLElement) => !element.matches(':disabled, [aria-disabled="true"]');
  const blocked = roots.some((root) =>
    Array.from(
      root.querySelectorAll<HTMLElement>('[role="dialog"], [class*="captcha"], [id*="captcha"], [class*="login"]'),
    ).some((element) => visible(element) && /验证码|扫码登录|请.*登录|安全验证|滑块/.test(element.textContent || "")),
  );
  const success = roots.some((root) =>
    Array.from(
      root.querySelectorAll<HTMLElement>('[role="status"], [role="alert"], h1, h2, .success-title, .publish-success'),
    ).some(
      (element) =>
        visible(element) && /^(发布成功|笔记发布成功|发布成功，.*)$/.test((element.textContent || "").trim()),
    ),
  );
  if (action === "publishState")
    return {
      submitReady: publishButtons.length === 1 && enabled(publishButtons[0]),
      blocked,
      success,
      selectedImages: roots
        .flatMap((root) => Array.from(root.querySelectorAll<HTMLInputElement>('input[type="file"]')))
        .reduce((count, input) => count + (input.files?.length || 0), 0),
    };
  if (action === "prepareImages") {
    if (blocked) throw new Error("需要登录或安全验证，请在平台窗口完成后继续");
    const imageInputs = roots
      .flatMap((root) => Array.from(root.querySelectorAll<HTMLInputElement>('input[type="file"]')))
      .filter((input) => !input.disabled && /image|\.png|\.jpe?g/i.test(input.accept));
    const bodies = roots
      .flatMap((root) =>
        Array.from(
          root.querySelectorAll<HTMLElement>('textarea, [contenteditable="true"], [contenteditable="plaintext-only"]'),
        ),
      )
      .filter(
        (element) =>
          usable(element) &&
          /正文|描述|\bcontent\b/i.test(metadata(element, "").label + metadata(element, "").placeholder),
      );
    if (imageInputs.length === 1 && bodies.length === 1) return { prepared: true };
    const candidates = roots
      .flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>('button, [role="tab"], span.title')))
      .filter(
        (element) =>
          visible(element) &&
          enabled(element) &&
          !element.closest('[inert], [aria-hidden="true"], [role="dialog"]') &&
          (element.textContent || "").trim() === "上传图文",
      );
    // A tab/button and its inner title span represent one action, not two.
    const tabs = candidates.filter(
      (element) => !candidates.some((parent) => parent !== element && ancestors(element).includes(parent)),
    );
    const selected = tabs.filter((element) =>
      ancestors(element).some((parent) => parent.getAttribute("aria-selected") === "true"),
    );
    if (selected.length === 1) return { prepared: true };
    if (tabs.length > 1) {
      const details = tabs
        .map((element, index) => {
          const rect = element.getBoundingClientRect();
          return `${index + 1}. ${element.tagName.toLowerCase()} role=${element.getAttribute("role") || "-"} class=${(element.className || "").toString().slice(0, 80)} 位置(${Math.round(rect.x)},${Math.round(rect.y)})`;
        })
        .join("；");
      throw new Error(
        `图文入口不唯一（${tabs.length} 个可见独立入口）：${details}。未点击，请在平台窗口选择图文，并提供此候选信息以便排查`,
      );
    }
    if (tabs.length === 1) tabs[0].click();
    return { prepared: true };
  }
  if (action === "submit") {
    if (blocked || success) throw new Error("当前页面不能自动提交，请检查登录或已有发布结果");
    const state = scope.__pupuDesktopObservation;
    if (!state || state.observationId !== args.observationId || state.url !== location.href)
      throw new Error("提交前页面发生变化，已停止");
    const matches = (id: string | null | undefined, expected: string | undefined) => {
      const index = state.candidates.findIndex((item) => item.id === id);
      const element = resolve(state, index);
      return element && usable(element) && read(element) === expected && unchanged(state, element, index);
    };
    if (!matches(args.id, args.expectedTitle) || (args.expectedContent && !matches(args.bodyId, args.expectedContent)))
      throw new Error("提交前文字核验失败");
    if (publishButtons.length !== 1 || !enabled(publishButtons[0])) throw new Error("发布入口不唯一或尚未就绪，未提交");
    publishButtons[0].click();
    return { submitted: true };
  }
  if (action === "observe") {
    const elements = roots.flatMap((root) =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'input[type="text"], input:not([type]), textarea, [contenteditable="true"], [contenteditable="plaintext-only"]',
        ),
      ).filter(usable),
    );
    if (elements.length > 20) throw new Error("页面可编辑字段超过 20 个，请切换到发布编辑页");
    const candidates = elements.map((element, index) => metadata(element, `e${index}`));
    const state: State = {
      observationId: crypto.randomUUID(),
      url: location.href,
      elements,
      candidates,
      written: {},
      containers: elements.map((element) => element.getRootNode() as Document | ShadowRoot),
    };
    scope.__pupuDesktopObservation = state;
    const bodies = candidates.filter(
      (item) =>
        /正文|描述|\bcontent\b/i.test(item.label + item.placeholder) && !/搜索/.test(item.label + item.placeholder),
    );
    return {
      observationId: state.observationId,
      url: state.url,
      candidates,
      bodyId: bodies.length === 1 ? bodies[0].id : null,
    };
  }
  const state = scope.__pupuDesktopObservation;
  if (!state || state.observationId !== args.observationId || state.url !== location.href)
    throw new Error("页面观察已失效，请重新观察");
  const index = state.candidates.findIndex((item) => item.id === args.id);
  const element = resolve(state, index);
  if (!element || !usable(element) || !unchanged(state, element, index)) {
    const reason = !element?.isConnected
      ? "编辑器节点被替换"
      : !usable(element)
        ? "编辑器不可见或不可编辑"
        : "字段标签或占位提示发生变化";
    throw new Error(`目标字段已变化（${args.id}：${reason}），已停止操作`);
  }
  if (action === "read") return { value: read(element) };
  if (typeof args.text !== "string") throw new Error("填写内容无效");
  if (read(element) === args.text) return { value: read(element) };
  if (read(element).trim()) throw new Error("目标已有不同内容，不会自动覆盖，请手动清空或修改");
  state.written[state.candidates[index].id] = args.text;
  element.focus();
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (!setter) throw new Error("当前字段无法安全填写");
    setter.call(element, args.text);
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
    if (!document.execCommand("insertText", false, args.text)) throw new Error("编辑器不支持原生文字插入，请手动填写");
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return { value: read(element) };
}
