import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type { FileData } from "~sync/common";
// ⚠️ pdf.js worker 不能通过 `import "pdfjs-dist/build/pdf.worker.min.mjs"` 打进主
// bundle（esbuild 会把其 Node API 调用注入顶层，浏览器执行抛错导致扩展加载失败），
// 也不能用 `new URL(..., import.meta.url)`（Plasmo CJS 产物下被解析成无效 file://）。
// 正确做法：worker 作为独立文件由 scripts/copy-pdf-worker.mjs 复制到产物根目录，
// 这里用 chrome.runtime.getURL 引用（CSP 'self' 允许加载扩展自身资源）。
GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.mjs");

export interface PdfConvertResult {
  /** 每一页转换成的图片 */
  images: FileData[];
  /** 每页一个 <img> 组成的 HTML，可直接放入编辑器预览 */
  html: string;
  /** 页数 */
  pageCount: number;
}

/** 输出图片的像素倍率（PDF 1pt → PIXEL_RATIO px，默认 96dpi 下 1pt≈1px） */
const PIXEL_RATIO = 1.5;
/** 页数过多时最多转换前多少页 */
const MAX_PAGES = 18;

/** 将 canvas 转为 PNG Blob */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas toBlob 失败"))), "image/png");
  });
}

/** 将 .pdf 文件的每一页转换为 PNG 图片（blob URL），并生成对应 HTML。 */
export async function convertPdfToImages(
  arrayBuffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void,
): Promise<PdfConvertResult> {
  const loadingTask = getDocument({
    data: new Uint8Array(arrayBuffer),
    // 黑白扫描书（stencil/CCITT）依赖 JBIG2/OpenJPEG WASM 解码器；不提供 wasmUrl 时
    // 解码失败、图像被忽略 → 渲染成空白页。wasm 由 copy-pdf-worker.mjs 复制到产物 /wasm。
    wasmUrl: chrome.runtime.getURL("wasm/"),
  });
  const pdf = await loadingTask.promise;
  const images: FileData[] = [];
  const imgTags: string[] = [];

  try {
    const pageCount = Math.min(pdf.numPages, MAX_PAGES);
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: PIXEL_RATIO });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        continue;
      }
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      const blob = await canvasToBlob(canvas);
      const url = URL.createObjectURL(blob);
      images.push({
        name: `page_${i}.png`,
        url,
        type: "image/png",
        size: blob.size,
      });
      imgTags.push(`<p><img src="${url}" alt="page-${i}" /></p>`);
      onProgress?.(i, pageCount);
    }

    return { images, html: imgTags.join(""), pageCount };
  } finally {
    await loadingTask.destroy();
  }
}
