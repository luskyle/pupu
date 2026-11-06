interface FirefoxSidebarAction {
  open(): Promise<void>;
}

function getFirefoxSidebar(): FirefoxSidebarAction | undefined {
  return (globalThis as typeof globalThis & { browser?: { sidebarAction?: FirefoxSidebarAction } }).browser
    ?.sidebarAction;
}

async function openSidebar(): Promise<void> {
  const sidebar = getFirefoxSidebar();
  if (sidebar) {
    await sidebar.open();
    return;
  }

  if (!chrome.sidePanel?.open) throw new Error("浏览器不支持打开侧边栏");
  const currentWindow = await chrome.windows.getCurrent({ populate: true });
  if (currentWindow.id === undefined) throw new Error("无法确定当前窗口");
  await chrome.sidePanel.open({ windowId: currentWindow.id });
}

export async function openSidebarWithState(state: Record<string, unknown>): Promise<void> {
  if (getFirefoxSidebar()) {
    // Firefox 要求 sidebarAction.open 在用户手势中直接调用，不能等 storage.set 完成后再调用。
    await Promise.all([chrome.storage.local.set(state), openSidebar()]);
  } else {
    await chrome.storage.local.set(state);
    await openSidebar();
  }
}

export async function openSidebarFromBackground(state: Record<string, unknown>): Promise<void> {
  if (getFirefoxSidebar()) {
    await chrome.storage.local.set(state);
    await chrome.tabs.create({ url: chrome.runtime.getURL("sidepanel.html") });
    return;
  }
  await openSidebarWithState(state);
}

export function closeSidebarWhenIdle(): void {
  // Firefox 不允许在计时器或存储变更事件中调用 sidebarAction.close。
  if (!getFirefoxSidebar()) window.close();
}
