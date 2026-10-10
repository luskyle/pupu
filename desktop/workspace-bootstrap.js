import { installWorkspaceChrome } from "./workspace-chrome.js";

try {
  await installWorkspaceChrome(window.pupuWorkspace);
  await import("./workspace-ui");
} catch (error) {
  console.error("桌面工作台启动失败", error);
  document.getElementById("workspace-root").textContent = `工作台启动失败：${error.message}`;
}
