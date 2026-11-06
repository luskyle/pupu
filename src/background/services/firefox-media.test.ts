import { afterEach, describe, expect, it, vi } from "vitest";
import { firefoxMediaMessageHandler } from "./firefox-media";

const origin = "moz-extension://12345678-1234-1234-1234-123456789abc/";
const url = `blob:${origin}aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Firefox media message handler", () => {
  it("returns an extension-owned blob using Firefox structured cloning", async () => {
    const blob = new Blob(["local media"]);
    const fetch = vi.fn(async () => new Response(blob));
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("browser", { runtime: { getBrowserInfo: vi.fn() } });
    vi.stubGlobal("chrome", { runtime: { id: "pupu@test", getURL: () => origin } });
    const sendResponse = vi.fn();

    expect(
      firefoxMediaMessageHandler({ type: "PUPU_EXTENSION_GET_FIREFOX_BLOB", url }, { id: "pupu@test" }, sendResponse),
    ).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(url);
    expect(await sendResponse.mock.calls[0][0].blob.text()).toBe("local media");
  });

  it.each([
    ["another sender", "other@test", url],
    ["another origin", "pupu@test", "blob:moz-extension://another-extension/id"],
    ["a network URL", "pupu@test", "https://example.com/private"],
  ])("rejects %s without fetching", (_label, senderId, candidate) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("browser", { runtime: { getBrowserInfo: vi.fn() } });
    vi.stubGlobal("chrome", { runtime: { id: "pupu@test", getURL: () => origin } });
    const sendResponse = vi.fn();

    expect(
      firefoxMediaMessageHandler(
        { type: "PUPU_EXTENSION_GET_FIREFOX_BLOB", url: candidate },
        { id: senderId },
        sendResponse,
      ),
    ).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: expect.any(String) });
    expect(fetch).not.toHaveBeenCalled();
  });
});
