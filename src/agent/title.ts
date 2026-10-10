import type { FieldCandidate } from "./decision";

function usable(element: HTMLElement): boolean {
  if (element instanceof HTMLInputElement && element.type !== "text") return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return (
    element.isConnected &&
    rect.width > 20 &&
    rect.height > 0 &&
    style.visibility === "visible" &&
    style.display !== "none" &&
    !element.closest('[inert], [aria-hidden="true"], nav, [role="search"], [role="dialog"]') &&
    !element.matches(':disabled, [readonly], [aria-disabled="true"]')
  );
}

function metadata(element: HTMLElement, id: string): FieldCandidate {
  return {
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
    placeholder: (element.getAttribute("placeholder") || element.getAttribute("data-placeholder") || "").slice(0, 120),
  };
}

function read(element: HTMLElement): string {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    ? element.value
    : element.textContent || "";
}

export async function fillTitleWithAgent(title: string, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const roots: (Document | ShadowRoot)[] = [document];
  for (let i = 0; i < roots.length; i++) {
    for (const element of roots[i].querySelectorAll("*")) {
      if (element.shadowRoot) roots.push(element.shadowRoot);
    }
  }
  const elements = roots.flatMap((root) =>
    Array.from(
      root.querySelectorAll<HTMLElement>(
        'input[type="text"], input:not([type]), textarea, [contenteditable="true"], [contenteditable="plaintext-only"]',
      ),
    ).filter(usable),
  );
  if (!elements.length) throw new Error("没有可读取的标题候选，请手动填写（closed shadow DOM 不支持智能定位）");
  if (elements.length > 20) throw new Error("可编辑字段过多，无法安全定位，请手动填写");
  const candidates = elements.map((element, i) => metadata(element, `e${i}`));
  const url = location.href;
  const clearMatches = candidates.filter(
    (candidate) =>
      /标题|\btitle\b/i.test(`${candidate.label} ${candidate.placeholder}`) &&
      !/副标题|subtitle|正文|搜索/i.test(`${candidate.label} ${candidate.placeholder}`),
  );
  const response =
    clearMatches.length === 1
      ? { ok: true, choice: clearMatches[0].id }
      : await chrome.runtime.sendMessage({ type: "PUPU_AGENT_SELECT_TITLE", candidates });
  signal.throwIfAborted();
  if (!response?.ok) throw new Error(response?.error || "本地决策服务未返回结果");
  const index = candidates.findIndex((candidate) => candidate.id === response.choice);
  if (index < 0) throw new Error("本地模型未能确认标题字段，请手动填写");
  const element = elements[index];
  if (
    location.href !== url ||
    !usable(element) ||
    JSON.stringify(metadata(element, candidates[index].id)) !== JSON.stringify(candidates[index])
  ) {
    throw new Error("页面已变化，已停止填写，请重新检查页面");
  }
  if (read(element) === title) return;
  if (read(element).trim()) throw new Error("目标字段已有内容，已停止覆盖，请手动确认");
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    throw new Error("当前标题使用富文本编辑器，试点不支持安全填写，请手动处理");
  }
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("标题字段不支持原生写入");
  signal.throwIfAborted();
  element.focus();
  setter.call(element, title);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 500));
  signal.throwIfAborted();
  if (location.href !== url || !usable(element) || read(element) !== title)
    throw new Error("标题回读核验失败，请在平台手动检查");
}
