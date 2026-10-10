import type { PlasmoCSConfig } from "plasmo";
import { DynamicRednote } from "~sync/dynamic/rednote";

export const config: PlasmoCSConfig = {
  matches: ["https://creator.xiaohongshu.com/*"],
  run_at: "document_idle",
};

let running = false;
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type !== "PUPU_REDNOTE_FILL") return false;
  if (
    sender.id !== chrome.runtime.id ||
    sender.tab ||
    (sender.url && !sender.url.startsWith(chrome.runtime.getURL("")))
  ) {
    sendResponse({ ok: false, error: "只允许扩展后台启动填写任务" });
    return false;
  }
  if (running) {
    sendResponse({ ok: false, error: "当前页面已有填写任务，请等待或手动处理" });
    return false;
  }
  running = true;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("填写任务超时，已请求停止，请手动核对页面")),
    request.agentEnabled ? 150_000 : 270_000,
  );
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;bottom:20px;right:20px;z-index:2147483647;background:#fff;color:#111;padding:16px;border:1px solid #888;border-radius:12px";
  const message = document.createElement("span");
  message.textContent = request.agentEnabled ? "本地 Agent 试点：只填充，不自动发布 " : "pupu 正在填写 ";
  const stop = document.createElement("button");
  stop.textContent = "停止";
  stop.onclick = () => {
    controller.abort(new Error("用户已停止填写，请检查平台页面"));
    message.textContent = "已请求停止；已填写内容不会自动撤销 ";
  };
  panel.append(message, stop);
  document.body.append(panel);
  void DynamicRednote(request.data, request.agentEnabled === true, controller.signal, (stage) => {
    message.textContent = `${stage}${request.agentEnabled ? "；试点不自动发布 " : " "}`;
  })
    .then(() => {
      message.textContent = "已完成填写，请在平台检查内容与账号 ";
      sendResponse({ ok: true });
    })
    .catch((error) => {
      const text = error instanceof Error ? error.message : String(error);
      message.textContent = text;
      sendResponse({ ok: false, error: text });
    })
    .finally(() => {
      clearTimeout(timer);
      running = false;
      stop.textContent = "关闭提示";
      stop.onclick = () => panel.remove();
    });
  return true;
});
