import { isFirefox } from "~utils/browser";
import { logger } from "~utils/logger";

export function firefoxMediaMessageHandler(
  request: { type?: string; url?: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { ok: true; blob: Blob } | { ok: false; error: string }) => void,
): boolean {
  if (request?.type !== "PUPU_EXTENSION_GET_FIREFOX_BLOB") return false;
  if (
    !isFirefox() ||
    sender.id !== chrome.runtime.id ||
    typeof request.url !== "string" ||
    !request.url.startsWith(`blob:${chrome.runtime.getURL("")}`)
  ) {
    sendResponse({ ok: false, error: "不允许读取此媒体地址" });
    return true;
  }

  void fetch(request.url)
    .then(async (response) => {
      if (!response.ok) throw new Error(`媒体读取失败 (${response.status})`);
      sendResponse({ ok: true, blob: await response.blob() });
    })
    .catch((error) => {
      logger.error("读取 Firefox 本地媒体失败:", error);
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });
  return true;
}
