export function isFirefox(): boolean {
  const browser = (globalThis as typeof globalThis & { browser?: { runtime?: { getBrowserInfo?: unknown } } }).browser;
  return typeof browser?.runtime?.getBrowserInfo === "function";
}
