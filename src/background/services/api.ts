import { Storage } from "@plasmohq/storage";
import { getPlatformInfos } from "~sync/common";
import { logger } from "~utils/logger";

const storage = new Storage({ area: "local" });

// 后端服务地址（扩展默认不依赖外部后端；如有自建服务可在此替换）
const host = process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://pupu.app";

export const ping = async (withPlatforms = false) => {
  const apiKey = await storage.get("apiKey");
  if (!apiKey) {
    return;
  }
  const extensionClientId = (await storage.get("extensionClientId")) || "";
  const body = {
    extensionVersion: chrome.runtime.getManifest().version,
    extensionClientId,
    platformInfos: undefined,
  };
  if (withPlatforms) {
    let platformInfos = await getPlatformInfos();
    platformInfos = platformInfos.map((platform) => {
      const platformCopy = { ...platform };
      platformCopy.injectFunction = undefined;
      if (platformCopy.accountInfo) {
        platformCopy.accountInfo.extraData = undefined;
      }
      return platformCopy;
    });
    body.platformInfos = platformInfos;
  }

  const response = await fetch(`${host}/api/extension/ping`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (response.ok) {
    const body = await response.json();
    if (!body.success && body.error === "KEY_EXPIRED") {
      await storage.remove("apiKey");
    } else if (!body.success && body.error === "CLIENT_NOT_FOUND") {
      await storage.remove("extensionClientId");
    } else if (body.success && body.data.action === "NEW_TASK") {
      chrome.tabs.create({ url: body.data.url });
    } else if (body.success && body.data.action === "NEW_CLIENT") {
      await storage.set("extensionClientId", body.data.clientId);
    }
  }
  return null;
};

export const linkExtensionMessageHandler = (request, _sender, sendResponse) => {
  if (request.action === "PUPU_EXTENSION_LINK_EXTENSION") {
    logger.debug("request", request);
    const params = {
      action: "PUPU_EXTENSION_LINK_EXTENSION",
      apiKey: request.data.apiKey,
    };

    const encodedParams = btoa(JSON.stringify(params));

    const linkExtensionListener = (message, _authSender, authSendResponse) => {
      if (message.type === "PUPU_EXTENSION_LINK_EXTENSION_CONFIRM") {
        const { confirm } = message;
        sendResponse({ confirm });
        authSendResponse("success");
        chrome.runtime.onMessage.removeListener(linkExtensionListener);
      }
    };
    chrome.runtime.onMessage.addListener(linkExtensionListener);

    // 打开信任域名确认窗口
    chrome.windows
      .create({
        url: chrome.runtime.getURL(`tabs/link-extension.html#${encodedParams}`),
        type: "popup",
        width: 800,
        height: 600,
      })
      .catch((error) => {
        chrome.runtime.onMessage.removeListener(linkExtensionListener);
        sendResponse({ confirm: false, error: String(error instanceof Error ? error.message : error) });
      });
    return true;
  }
  return false;
};

export const starter = (interval: number) => {
  ping(true);
  setInterval(ping, interval);
};
