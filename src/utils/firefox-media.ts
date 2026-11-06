import type { SyncData } from "~sync/common";

type FirefoxBlobResponse = { ok: true; blob: Blob } | { ok: false; error: string };

const BLOB_URL_PATTERN = /blob:moz-extension:\/\/[a-f\d-]+\/[a-f\d-]+/gi;
// 网站的 connect-src 可能禁止读取 blob URL，适配器需要直接使用已转发的 Blob。
const pageBlobs = new Map<string, Blob>();

export function fetchFirefoxMedia(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.href;
  const blob = pageBlobs.get(url);
  if (!blob) return globalThis.fetch(input, init);

  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  if (signal?.aborted) return Promise.reject(signal.reason);
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  if (method.toUpperCase() !== "GET") return Promise.reject(new TypeError("无法对本地媒体执行非 GET 请求"));
  return Promise.resolve(new Response(blob));
}

function visitStrings(value: unknown, visit: (text: string) => string): unknown {
  if (typeof value === "string") return visit(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) value[index] = visitStrings(value[index], visit);
  } else if (value && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, entry] of Object.entries(value)) {
      Object.assign(value, { [key]: visitStrings(entry, visit) });
    }
  }
  return value;
}

/**
 * Firefox content scripts cannot fetch blob URLs owned by an extension page.
 * Clone those blobs into the target page's origin, including URLs embedded in HTML.
 */
export async function prepareFirefoxMedia(data: SyncData): Promise<void> {
  const ownBlobPrefix = `blob:${chrome.runtime.getURL("")}`;
  const urls = new Set<string>();
  visitStrings(data, (text) => {
    for (const match of text.matchAll(BLOB_URL_PATTERN)) {
      if (match[0].startsWith(ownBlobPrefix)) urls.add(match[0]);
    }
    return text;
  });
  if (urls.size === 0) return;

  const runtime = (
    globalThis as typeof globalThis & {
      browser: { runtime: { sendMessage: (message: unknown) => Promise<FirefoxBlobResponse> } };
    }
  ).browser.runtime;
  const blobs = await Promise.all(
    Array.from(urls, async (url) => {
      const response = await runtime.sendMessage({ type: "PUPU_EXTENSION_GET_FIREFOX_BLOB", url });
      if (!response) throw new Error("无法读取 Firefox 本地媒体");
      if (response.ok === false) throw new Error(response.error);
      if (!(response.blob instanceof Blob)) throw new Error("Firefox 本地媒体响应无效");
      return [url, response.blob] as const;
    }),
  );
  const replacements = new Map(
    blobs.map(([url, blob]) => {
      const pageUrl = URL.createObjectURL(blob);
      pageBlobs.set(pageUrl, blob);
      return [url, pageUrl];
    }),
  );
  visitStrings(data, (text) => text.replace(BLOB_URL_PATTERN, (url) => replacements.get(url) ?? url));
}
