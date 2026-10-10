import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WorkspaceStorage } from "./workspace-storage";

describe("workspace storage", () => {
  it("persists preferences, serializes concurrent writes and never restores stale media drafts", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "pupu-storage-test-"));
    const file = path.join(directory, "storage.json");
    try {
      const storage = new WorkspaceStorage(file);
      await storage.load();
      await Promise.all([
        storage.change("local", { theme: "dark" }),
        storage.change("local", { platforms: ["DYNAMIC_WEIBO"] }),
        storage.change("local", { pendingPublishData: { url: "blob:expired" } }),
        storage.change("session", { task: "active" }),
      ]);
      expect(storage.get("local", ["theme", "platforms"])).toEqual({ theme: "dark", platforms: ["DYNAMIC_WEIBO"] });
      expect(storage.get("local", { missing: 1 })).toEqual({ missing: 1 });
      const reloaded = new WorkspaceStorage(file);
      await reloaded.load();
      expect(reloaded.get("local", null)).toEqual({ theme: "dark", platforms: ["DYNAMIC_WEIBO"] });
      expect(reloaded.get("session", null)).toEqual({});
      await reloaded.change("local", { theme: undefined }, true);
      expect(JSON.parse(await readFile(file, "utf8")).local.theme).toBeUndefined();
      expect(() => reloaded.area("invalid")).toThrow();
    } finally {
      await rm(file, { force: true });
      await rm(`${file}.tmp`, { force: true });
      await rm(directory, { recursive: true, force: true });
    }
  });
});
