import { useEffect } from "react";

// 这个 popup 只做一件事：打开扩展主界面（选项页）后关闭自身，不渲染任何 UI。
//
// 因此刻意不引入 `~style.css`、`data-text:~style.css` 与 Plasmo 的 shadow 容器样板
// （getStyle / getShadowContainer / getShadowHostId）—— 那套样板只在「组件挂载到
// shadow root」的内容脚本场景下才需要，而这里会把整套 Tailwind 打进这个空壳：
// 实测该文件曾因此达到 369 KB，精简后降到 1 KB 量级。
const IndexPopup = () => {
  useEffect(() => {
    void chrome.runtime.openOptionsPage();
    window.close();
  }, []);

  return null;
};

export default IndexPopup;
