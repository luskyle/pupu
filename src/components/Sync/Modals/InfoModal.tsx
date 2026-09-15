import { Button } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

interface InfoModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  /** 可选：确认按钮文案；提供时显示「取消 + 确认」两个按钮 */
  confirmText?: string;
  /** 可选：确认按钮回调（无则点击确认等同于 onClose） */
  onConfirm?: () => void;
  /** 确认按钮是否为红色危险样式 */
  danger?: boolean;
}

/**
 * 轻量弹窗：替代 HeroUI Modal 与浏览器 alert。
 * 不用 framer-motion、不 portal 到 body——直接在组件树内渲染（shadow DOM 内，有样式）。
 * 用 CSS animation（@keyframes：modal-in/out + fade-in/out）做进入/退场动画，
 * 挂载即自动播放（无 rAF 额外一帧延迟，打开更快），退场动画结束再卸载，彻底避免卡顿。
 * 无 confirmText 时是「提示」弹窗（只有确定按钮）；传入 confirmText/onConfirm 时是「确认」弹窗。
 */
export default function InfoModal({
  isOpen,
  title,
  message,
  onClose,
  confirmText,
  onConfirm,
  danger = false,
}: InfoModalProps) {
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

  const hasConfirm = !!confirmText && !!onConfirm;
  const confirmLabel = confirmText || chrome.i18n.getMessage("optionsOk") || "确定";

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
      {/* 弹窗卡片：用 div 自定义布局，不使用原生 dialog 的默认定位/样式 */}
      {/* biome-ignore lint/a11y/useSemanticElements: 自绘弹窗需自定义 fixed 布局，不用原生 dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-sm rounded-2xl border border-slate-200/70 bg-white p-6 shadow-xl dark:border-slate-700/70 dark:bg-slate-900 ${
          shown ? "animate-modal-in" : "animate-modal-out"
        }`}>
        {title && <h3 className="mb-3 text-base font-semibold">{title}</h3>}
        <p className="text-sm text-default-600 dark:text-default-400">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          {hasConfirm && (
            <Button variant="light" onPress={onClose}>
              {chrome.i18n.getMessage("optionsCancel") || "取消"}
            </Button>
          )}
          <Button color={danger ? "danger" : "primary"} onPress={hasConfirm ? onConfirm : onClose}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
