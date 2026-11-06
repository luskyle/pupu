import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFirefoxMedia, prepareFirefoxMedia } from "./firefox-media";

const extensionOrigin = "moz-extension://12345678-1234-1234-1234-123456789abc/";
const blobUrl = `blob:${extensionOrigin}aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Firefox media transfer", () => {
  it("clones each extension blob once and replaces URLs in files and HTML", async () => {
    const blob = new Blob(["image-data"], { type: "image/png" });
    const sendMessage = vi.fn(async () => ({ ok: true, blob }));
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:https://example.com/translated");
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    vi.stubGlobal("chrome", { runtime: { getURL: () => extensionOrigin } });
    const data = {
      platforms: [],
      isAutoPublish: false,
      data: {
        title: "test",
        digest: "",
        cover: { name: "image.png", url: blobUrl },
        images: [{ name: "image.png", url: blobUrl }],
        htmlContent: `<img src="${blobUrl}"><img src="https://example.com/a.png">`,
        markdownContent: `![image](${blobUrl})`,
      },
    };

    await prepareFirefoxMedia(data);

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith({ type: "PUPU_EXTENSION_GET_FIREFOX_BLOB", url: blobUrl });
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(data.data.cover.url).toBe("blob:https://example.com/translated");
    expect(data.data.images[0].url).toBe("blob:https://example.com/translated");
    expect(data.data.htmlContent).toBe(
      '<img src="blob:https://example.com/translated"><img src="https://example.com/a.png">',
    );
    expect(data.data.markdownContent).toBe("![image](blob:https://example.com/translated)");
    const response = await fetchFirefoxMedia("blob:https://example.com/translated");
    expect(await response.text()).toBe("image-data");
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("preserves abort and method semantics for relayed media", async () => {
    vi.stubGlobal("browser", { runtime: { sendMessage: vi.fn(async () => ({ ok: true, blob: new Blob(["data"]) })) } });
    vi.stubGlobal("chrome", { runtime: { getURL: () => extensionOrigin } });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:https://example.com/abort");
    await prepareFirefoxMedia({
      platforms: [],
      isAutoPublish: false,
      data: { title: "", content: "", images: [{ name: "image", url: blobUrl }], videos: [] },
    });
    const controller = new AbortController();
    controller.abort(new Error("stopped"));
    await expect(fetchFirefoxMedia("blob:https://example.com/abort", { signal: controller.signal })).rejects.toThrow(
      "stopped",
    );
    await expect(fetchFirefoxMedia("blob:https://example.com/abort", { method: "POST" })).rejects.toThrow("非 GET");
  });

  it("delegates unrelated requests to the browser's native fetch", async () => {
    const nativeFetch = vi.fn(async () => new Response("network"));
    vi.stubGlobal("fetch", nativeFetch);
    const response = await fetchFirefoxMedia("https://example.com/api");
    expect(nativeFetch).toHaveBeenCalledWith("https://example.com/api", undefined);
    expect(await response.text()).toBe("network");
  });

  it("does not request blobs belonging to another origin", async () => {
    const sendMessage = vi.fn();
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    vi.stubGlobal("chrome", { runtime: { getURL: () => extensionOrigin } });
    const otherUrl = "blob:moz-extension://87654321-4321-4321-4321-cba987654321/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    await prepareFirefoxMedia({
      platforms: [],
      isAutoPublish: false,
      data: { title: "", content: "", images: [{ name: "other", url: otherUrl }], videos: [] },
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("surfaces media retrieval failures without mutating publish data", async () => {
    vi.stubGlobal("browser", { runtime: { sendMessage: vi.fn(async () => ({ ok: false, error: "expired" })) } });
    vi.stubGlobal("chrome", { runtime: { getURL: () => extensionOrigin } });
    const data = {
      platforms: [],
      isAutoPublish: false,
      data: { title: "", content: "", images: [{ name: "image", url: blobUrl }], videos: [] },
    };

    await expect(prepareFirefoxMedia(data)).rejects.toThrow("expired");
    expect(data.data.images[0].url).toBe(blobUrl);
  });
});
