import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { object } from "./workspace-policy";

export class WorkspaceStorage {
  private areas: Record<string, Record<string, unknown>> = { local: {}, sync: {}, session: {} };
  private writes = Promise.resolve();
  constructor(private file: string) {}

  async load() {
    try {
      const stored = object(JSON.parse(await readFile(this.file, "utf8")));
      this.areas.local = object(stored.local);
      this.areas.sync = object(stored.sync);
      Reflect.deleteProperty(this.areas.local, "pendingPublishData");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  area(name: unknown) {
    if (typeof name !== "string" || !Object.hasOwn(this.areas, name)) throw new Error("存储区域无效");
    return this.areas[name];
  }

  get(area: unknown, keys: unknown) {
    const values = this.area(area);
    if (keys === undefined || keys === null) return { ...values };
    if (typeof keys === "string") return { [keys]: values[keys] };
    if (Array.isArray(keys) && keys.every((key) => typeof key === "string"))
      return Object.fromEntries(keys.map((key) => [key, values[key]]));
    const defaults = object(keys);
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, values[key] ?? fallback]));
  }

  async change(area: unknown, changes: Record<string, unknown>, remove = false) {
    const values = this.area(area);
    const events: Record<string, { oldValue: unknown; newValue?: unknown }> = {};
    for (const [key, value] of Object.entries(changes)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") throw new Error("存储键无效");
      events[key] = { oldValue: values[key], newValue: remove ? undefined : value };
      if (remove) Reflect.deleteProperty(values, key);
      else values[key] = value;
    }
    if (area !== "session") {
      const local = { ...this.areas.local };
      Reflect.deleteProperty(local, "pendingPublishData");
      const serialized = JSON.stringify({ local, sync: this.areas.sync });
      const write = this.writes.then(async () => {
        await mkdir(path.dirname(this.file), { recursive: true });
        await writeFile(`${this.file}.tmp`, serialized, { mode: 0o600 });
        await rename(`${this.file}.tmp`, this.file);
      });
      this.writes = write.catch(() => {});
      await write;
    }
    return events;
  }
}
