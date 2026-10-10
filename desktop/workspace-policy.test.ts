import { describe, expect, it } from "vitest";
import { adapterAllowed, object, shouldReveal, webURL } from "./workspace-policy";

const platform = {
  name: "DYNAMIC_WEIBO",
  accountKey: "weibo",
  platformName: "微博",
  homeUrl: "https://weibo.com",
  injectUrl: "https://weibo.com",
};

describe("desktop platform policy", () => {
  it("rejects local files, credentials and executable URLs", () => {
    for (const url of [
      "file:///etc/passwd",
      "javascript:alert(1)",
      "https://user:password@weibo.com",
      "http://localhost",
    ])
      expect(() => webURL(url)).toThrow();
    expect(webURL("https://weibo.com")).toBe("https://weibo.com/");
    expect(() => object([])).toThrow();
  });
  it("requires the registered platform origin and current page origin", () => {
    expect(adapterAllowed(platform, "https://weibo.com/", "https://weibo.com/compose")).toBe(true);
    expect(adapterAllowed(platform, "https://weibo.com/", "https://evil.example")).toBe(false);
    expect(adapterAllowed(platform, "https://evil.example", "https://evil.example")).toBe(false);
    expect(
      adapterAllowed(
        { ...platform, name: "ARTICLE_WORDPRESS" },
        "https://myblog.example/edit",
        "https://myblog.example/edit",
      ),
    ).toBe(true);
  });
  it("does not reveal platform tabs while creating a batch or reloading for retry", () => {
    expect(shouldReveal({ active: true }, true)).toBe(false);
    expect(shouldReveal({ active: true, url: "https://weibo.com" }, false)).toBe(false);
    expect(shouldReveal({ active: true }, false)).toBe(true);
    expect(shouldReveal({}, false)).toBe(false);
  });
});
