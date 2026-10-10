// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { transferWorkspaceData } from "./workspace-data";

describe("workspace media transfer", () => {
  it("transfers chunks once and rewrites HTML, Markdown, cover and origin URLs consistently", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const blob = {
      size: 3,
      type: "image/png",
      slice: () => ({ arrayBuffer: async () => bytes.buffer }),
    };
    const fetchFile = vi.fn(async () => ({ ok: true, blob: async () => blob }));
    const invoke = vi.fn(async (action) =>
      action === "mediaStart" ? { token: "test", url: "pupu-media://asset/test" } : undefined,
    );
    const input = {
      data: {
        images: [{ url: "blob:local", name: "image.png" }],
        cover: { url: "blob:local" },
        htmlContent: '<img src="blob:local">',
        markdownContent: "![](blob:local)",
      },
      origin: { htmlContent: '<img src="blob:local">' },
    };
    const output = await transferWorkspaceData(input, invoke, fetchFile);
    expect(fetchFile).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls.map(([action]) => action)).toEqual(["mediaStart", "mediaChunk", "mediaFinish"]);
    expect(output.data.images[0].url).toBe("pupu-media://asset/test");
    expect(output.data.cover.url).toBe(output.data.images[0].url);
    expect(output.origin.htmlContent).toContain("pupu-media://asset/test");
    expect(input.data.images[0].url).toBe("blob:local");
  });
  it("surfaces file read, transfer and size failures instead of using expired blob URLs", async () => {
    await expect(transferWorkspaceData({ url: "blob:bad" }, vi.fn(), async () => ({ ok: false }))).rejects.toThrow(
      "读取素材失败",
    );
    await expect(
      transferWorkspaceData({ url: "blob:large" }, vi.fn(), async () => ({
        ok: true,
        blob: async () => ({ size: 513 * 1024 * 1024 }),
      })),
    ).rejects.toThrow("512 MB");
    await expect(
      transferWorkspaceData(
        { url: "blob:error" },
        async () => {
          throw new Error("磁盘已满");
        },
        async () => ({
          ok: true,
          blob: async () => ({ size: 3, type: "image/png" }),
        }),
      ),
    ).rejects.toThrow("磁盘已满");
  });
});
