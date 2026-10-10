import { AGENT_SETTINGS_KEY, parseCandidates, parseSettings, selectTitle } from "~agent/decision";

export function agentMessageHandler(
  request: { type?: string; candidates?: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
): boolean {
  if (request.type !== "PUPU_AGENT_SELECT_TITLE" && request.type !== "PUPU_AGENT_TEST") return false;
  const isSettingsPage =
    sender.id === chrome.runtime.id &&
    !sender.tab &&
    sender.url?.split("#")[0] === chrome.runtime.getURL("options.html");
  const isEditor =
    sender.id === chrome.runtime.id &&
    sender.tab?.id !== undefined &&
    sender.frameId === 0 &&
    sender.url?.startsWith("https://creator.xiaohongshu.com/") === true;
  if ((request.type === "PUPU_AGENT_TEST" && !isSettingsPage) || (request.type !== "PUPU_AGENT_TEST" && !isEditor)) {
    sendResponse({ ok: false, error: "此页面无权调用本地决策服务" });
    return true;
  }
  void (async () => {
    try {
      const stored = await chrome.storage.local.get(AGENT_SETTINGS_KEY);
      const settings = parseSettings(stored[AGENT_SETTINGS_KEY]);
      if (request.type !== "PUPU_AGENT_TEST" && !settings.enabled) throw new Error("本地 Agent 已关闭");
      const candidates =
        request.type === "PUPU_AGENT_TEST"
          ? [{ id: "e1", kind: "input" as const, label: "标题", placeholder: "填写标题" }]
          : parseCandidates(request.candidates);
      const choice = await selectTitle(settings.model, candidates);
      if (request.type === "PUPU_AGENT_TEST" && choice !== "e1") throw new Error("模型未通过标题选择连接测试");
      sendResponse({ ok: true, choice });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
  return true;
}
