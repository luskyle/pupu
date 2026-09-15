/**
 * 扩展 UI 运行在 shadow DOM 内（#test-shadow）。HeroUI 的 Modal/Popover 默认
 * portal 到 document.body（shadow 外），那里没有 Tailwind 样式，会导致弹窗
 * 无样式/闪烁/卡顿。此工具返回 shadow DOM 内的内容器，供 portalContainer 使用，
 * 让弹窗渲染在 shadow 内以继承样式。
 */
export function getShadowPortalContainer(): HTMLElement | undefined {
  return document.querySelector("#test-shadow")?.shadowRoot?.querySelector("#plasmo-shadow-container") as
    | HTMLElement
    | undefined;
}

/** 统一的 Modal 动画（快速、丝滑，避免默认动画卡顿感） */
export function getFastModalMotionProps() {
  return {
    variants: {
      enter: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { duration: 0.15, ease: "easeOut" as const },
      },
      exit: {
        opacity: 0,
        scale: 0.97,
        y: 4,
        transition: { duration: 0.1, ease: "easeIn" as const },
      },
    },
  };
}
