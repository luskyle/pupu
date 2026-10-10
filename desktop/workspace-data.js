export async function transferWorkspaceData(data, invoke, fetchFile = fetch, cache = new Map()) {
  const replacements = new Map();
  async function visit(value) {
    if (Array.isArray(value)) return Promise.all(value.map(visit));
    if (!value || typeof value !== "object") return value;
    if (value instanceof File) return undefined;
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "videoFile") continue;
      if (key === "url" && typeof item === "string" && item.startsWith("blob:")) {
        if (!cache.has(item)) {
          const transfer = (async () => {
            const response = await fetchFile(item);
            if (!response.ok) throw new Error(`读取素材失败：${value.name || item}`);
            const blob = await response.blob();
            if (blob.size > 512 * 1024 * 1024) throw new Error("单个素材最多支持 512 MB");
            const asset = await invoke("mediaStart", { size: blob.size, type: blob.type });
            for (let offset = 0; offset < blob.size; offset += 4 * 1024 * 1024) {
              const bytes = new Uint8Array(await blob.slice(offset, offset + 4 * 1024 * 1024).arrayBuffer());
              await invoke("mediaChunk", { token: asset.token, bytes });
            }
            await invoke("mediaFinish", asset.token);
            return asset.url;
          })();
          cache.set(item, transfer);
          transfer.catch(() => cache.delete(item));
        }
        result[key] = await cache.get(item);
        replacements.set(item, result[key]);
      } else result[key] = await visit(item);
    }
    return result;
  }
  const output = await visit(data);
  function replace(value) {
    if (typeof value === "string") {
      for (const [before, after] of replacements) value = value.replaceAll(before, after);
      return value;
    }
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === "object") {
      for (const key of Object.keys(value)) value[key] = replace(value[key]);
    }
    return value;
  }
  return replace(output);
}
