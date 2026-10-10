export interface WorkspacePlatform {
  name: string;
  accountKey: string;
  platformName: string;
  homeUrl: string;
  injectUrl: string;
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("桌面请求结构无效");
  return value as Record<string, unknown>;
}

export function webURL(value: unknown): string {
  if (typeof value !== "string") throw new Error("缺少平台地址");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("平台只支持不含凭据的 HTTPS 地址");
  return url.href;
}

export function adapterAllowed(platform: WorkspacePlatform, initialURL: string, currentURL: string): boolean {
  const initial = new URL(initialURL);
  const current = new URL(currentURL);
  const expected = new URL(platform.injectUrl);
  return (
    current.protocol === "https:" &&
    initial.origin === current.origin &&
    (initial.origin === expected.origin || platform.name === "ARTICLE_WORDPRESS" || platform.name === "DYNAMIC_WEBHOOK")
  );
}

export function shouldReveal(update: { active?: unknown; url?: unknown }, batch: boolean): boolean {
  return update.active === true && !update.url && !batch;
}
