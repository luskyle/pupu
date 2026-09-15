import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

interface LightModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** 底部按钮区 */
  footer?: ReactNode;
  /** 最大宽度（Tailwind 类，默认 max-w-md） */
  maxWidth?: string;
  children: ReactNode;
}

/**
 * 通用轻量弹窗外壳：替代 HeroUI Modal（避免 framer-motion + portal 导致的卡顿）。
 * 组件树内渲染（shadow DOM 内，有样式），用 CSS animation（@keyframes）做进入/退场动画，
 * 挂载即自动播放（无 rAF 额外一帧延迟，打开更快），退场动画结束再卸载。
 */
export default function LightModal({
  isOpen,
  onClose,
  title,
  footer,
  maxWidth = "max-w-md",
  children,
}: LightModalProps) {
  // mounted：是否渲染（含退场动画期间）；shown：true 播进入动画，false 播退场动画
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(true);
  const exitTimer = useRef<number | null>(null);

  // 打开：渲染 + 立即播进入动画
  useEffect(() => {
    if (isOpen) {
      if (exitTimer.current) {
        window.clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
      setMounted(true);
      setShown(true);
    }
    return undefined;
  }, [isOpen]);

  // 关闭：播退场动画，结束后卸载
  useEffect(() => {
    if (!isOpen && mounted) {
      setShown(false);
      exitTimer.current = window.setTimeout(() => setMounted(false), 110);
    }
    return undefined;
  }, [isOpen, mounted]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* 遮罩（不加 backdrop-blur：全屏 blur 是性能杀手，拖慢弹窗） */}
      <div
        role="presentation"
        className={`absolute inset-0 bg-slate-900/50 ${shown ? "animate-fade-in" : "animate-fade-out"}`}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClose();
          }
        }}
      />
      {/* biome-ignore lint/a11y/useSemanticElements: 自绘弹窗需自定义 fixed 布局，不用原生 dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex max-h-[85vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-xl dark:border-slate-700/70 dark:bg-slate-900 ${
          shown ? "animate-modal-in" : "animate-modal-out"
        }`}>
        {title && (
          <div className="border-b border-slate-200/70 px-5 py-3.5 text-base font-semibold dark:border-slate-700/70">
            {title}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-200/70 px-5 py-3 dark:border-slate-700/70">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
