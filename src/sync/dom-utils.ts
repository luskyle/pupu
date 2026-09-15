/**
 * DOM 辅助工具：用于在普通 DOM 与 open shadow DOM 中深度查找元素。
 *
 * 部分平台（小红书、微信视频号等）会把关键操作按钮放在 open shadow DOM 内：
 * 按钮肉眼可见、点击正常，但 document.querySelectorAll 无法命中。
 * 因此查找按钮时必须递归遍历各元素的 shadowRoot。
 */

type QueryRoot = Document | ShadowRoot | DocumentFragment;

/** 递归收集 root 下的所有元素（含 open shadow DOM 与同源 iframe 内部） */
export function collectAllElements(root: QueryRoot = document): Element[] {
  const elements = Array.from(root.querySelectorAll("*"));
  const all = [...elements];
  for (const el of elements) {
    if (el.shadowRoot) {
      all.push(...collectAllElements(el.shadowRoot));
    }
    // 微前端常以 iframe 嵌入发布面板（如小红书创作者平台）
    if (el.tagName === "IFRAME") {
      try {
        const doc = (el as HTMLIFrameElement).contentDocument;
        if (doc) {
          all.push(...collectAllElements(doc));
        }
      } catch {
        // 跨域 iframe 无法访问，跳过
      }
    }
  }
  return all;
}

/** 深度查询所有可点击按钮（<button> 及 role="button"），含 shadow DOM 与 iframe */
export function queryAllButtons(root: QueryRoot = document): HTMLElement[] {
  return collectAllElements(root).filter(
    (el): el is HTMLElement => el.tagName === "BUTTON" || el.getAttribute("role") === "button",
  );
}

/** 判断按钮是否处于禁用状态（同时检查 disabled 属性与 aria-disabled） */
export function isButtonDisabled(button: HTMLElement): boolean {
  const el = button as HTMLButtonElement;
  return el.disabled === true || button.getAttribute("aria-disabled") === "true";
}

/**
 * 按文本关键字查找按钮（含 shadow DOM）。
 * 按 keywords 顺序优先匹配；exclude 中的关键字命中则跳过该按钮。
 * 例如排除“定时发布”，避免误点开关。
 */
export function findButtonByText(
  keywords: string[],
  exclude: string[] = [],
  root: Document | ShadowRoot = document,
): HTMLElement | null {
  const buttons = queryAllButtons(root);
  for (const keyword of keywords) {
    const found = buttons.find((b) => {
      const text = b.textContent ?? "";
      return text.includes(keyword) && !exclude.some((ex) => text.includes(ex));
    });
    if (found) return found;
  }
  return null;
}

/**
 * 轮询查找一个可用的（未禁用）按钮，期间每次都重新查询，
 * 避免页面重渲染后持有旧按钮节点导致点击无效。
 */
export async function findEnabledButtonByText(
  keywords: string[],
  exclude: string[] = [],
  timeoutMs = 30000,
  intervalMs = 1000,
): Promise<HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const button = findButtonByText(keywords, exclude);
    if (button && !isButtonDisabled(button)) {
      return button;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}
