import { toPng as toImagePng } from "html-to-image";
import html2canvas from "html2canvas";
import { init as initPptxPreview } from "pptx-preview";
import type { FileData } from "~sync/common";

export interface PptxConvertResult {
  /** 每一页幻灯片转换成的图片 */
  images: FileData[];
  /** 每页一个 <img> 组成的 HTML，可直接放入编辑器预览 */
  html: string;
  /** 幻灯片页数 */
  slideCount: number;
}

/** 输出图片的像素倍率（相对渲染宽度 960px） */
const PIXEL_RATIO = 1.5;
/** 幻灯片过多时最多转换前多少页 */
const MAX_PAGES = 18;

/**
 * 将单个幻灯片 DOM 节点捕获为 PNG Blob。
 * 优先使用 html-to-image（无需克隆整份文档，速度快很多）；
 * 失败时回退到 html2canvas，保证兼容性。
 */
async function captureSlide(slideEl: HTMLElement): Promise<Blob> {
  try {
    const dataUrl = await toImagePng(slideEl, {
      pixelRatio: PIXEL_RATIO,
      backgroundColor: "#ffffff",
      skipFonts: true,
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch (error) {
    console.warn("html-to-image 捕获失败，回退 html2canvas:", error);
    const canvas = await html2canvas(slideEl, {
      scale: PIXEL_RATIO,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas toBlob 失败"))), "image/png");
    });
  }
}

/**
 * 将 .pptx 文件的每一页转换为 PNG 图片（blob URL），并生成对应 HTML。
 * 通过 pptx-preview 逐页渲染到 DOM，再捕获为图片。
 *
 * 注意：捕获工具无法处理 shadow DOM 内的元素，因此渲染容器会被临时挂载到
 * document.body（light DOM）中，使用完成后移除。
 */
export async function convertPptxToImages(
  arrayBuffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void,
): Promise<PptxConvertResult> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);

  try {
    const previewer = initPptxPreview(container, { width: 960, height: 540, mode: "list" });
    await previewer.load(arrayBuffer);

    const slideCount = Math.min(previewer.slideCount, MAX_PAGES);
    const images: FileData[] = [];
    const imgTags: string[] = [];

    for (let i = 0; i < slideCount; i++) {
      previewer.renderSingleSlide(i);
      const slideEl = container.querySelector<HTMLElement>(`.pptx-preview-slide-wrapper-${i}`);
      if (!slideEl) {
        continue;
      }

      const blob = await captureSlide(slideEl);
      const url = URL.createObjectURL(blob);
      images.push({
        name: `slide_${i + 1}.png`,
        url,
        type: "image/png",
        size: blob.size,
      });
      imgTags.push(`<p><img src="${url}" alt="slide-${i + 1}" /></p>`);
      onProgress?.(i + 1, slideCount);
    }

    return { images, html: imgTags.join(""), slideCount };
  } finally {
    container.remove();
  }
}
