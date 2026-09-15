import { renderAsync } from "docx-preview";
import { toCanvas, toPng as toImagePng } from "html-to-image";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { FileData } from "~sync/common";
import { logger } from "~utils/logger";

export interface DocxConvertResult {
  /** 每一页转换成的图片 */
  images: FileData[];
  /** 每页一个 <img> 组成的 HTML，可直接放入编辑器预览 */
  html: string;
  /** 页数 */
  pageCount: number;
}

/** 输出图片的像素倍率（相对 96dpi 页面宽 ~794px） */
const PIXEL_RATIO = 1.5;
/** 页数过多时最多转换前多少页 */
const MAX_PAGES = 18;

/** 判断 ArrayBuffer 是否为 ZIP（OOXML 文档 .docx / 新版 .wps 均为 ZIP 容器）。 */
export function isZipBuffer(arrayBuffer: ArrayBuffer): boolean {
  const arr = new Uint8Array(arrayBuffer);
  return (
    arr.length > 4 &&
    arr[0] === 0x50 && // P
    arr[1] === 0x4b && // K
    arr[2] === 0x03 &&
    arr[3] === 0x04
  );
}

/**
 * 捕获前调整表格单元格：docx-preview 渲染出的单元格上下内边距为 0、内容正好
 * 填满格子高度，截图后文字会"压"在边框线上。这里给单元格加上下内边距并让高度
 * 自适应，保证文字与边框之间有间距。
 */
function fixTableCells(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("td, th").forEach((cell) => {
    cell.style.boxSizing = "border-box";
    cell.style.paddingTop = "3px";
    cell.style.paddingBottom = "3px";
    cell.style.height = "auto";
    cell.querySelectorAll<HTMLElement>("p, div").forEach((el) => {
      if (Number.parseFloat(el.style.height || "0") > 0) {
        el.style.height = "auto";
      }
    });
  });
}

/**
 * 捕获前清理会让 html-to-image 失败的不可见元素：
 * - 零尺寸的 <svg>：docx-preview 对浮动形状/对象会生成 width/height 为 0 的占位
 *   SVG（内含空 <image>），html-to-image 尝试加载其中的图片会抛错导致整页捕获失败。
 * - src 为空的 <img>/<image>。
 */
function sanitizeForCapture(root: HTMLElement): void {
  root.querySelectorAll("svg").forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      logger.debug("[pupu-docx] sanitize 移除零尺寸SVG:", {
        w: rect.width,
        h: rect.height,
        hasImage: !!el.querySelector("image"),
        inner: el.innerHTML.slice(0, 200),
      });
      el.remove();
    }
  });
  root.querySelectorAll("img, image").forEach((el) => {
    if (!el.getAttribute("src")) {
      logger.debug(
        "[pupu-docx] sanitize 移除无src元素:",
        el.tagName,
        el.getAttribute("href") || "",
        el.outerHTML.slice(0, 200),
      );
      el.remove();
    }
  });
}

/** 给 Promise 加超时，避免 html-to-image 因异常图片一直挂起 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`捕获超时: ${label}`)), ms);
    }),
  ]);
}

/**
 * 捕获前把 docx-preview 渲染出的"浮于文字上方/下方"（wp:anchor + wrapNone）
 * 浮动图片转为脱离文档流（position:absolute）。
 *
 * docx-preview 对 wrapNone 用 0×0 的 relative 容器 + left/top 偏移渲染浮动图片，
 * 但图片本身仍是文档流中的 relative 元素，会：
 *   1) 把所在段落撑高（图片高度），导致后续文字被顶下去（与 Word 不符，即
 *      "后面的文字上移"的根因）；
 *   2) 图片视觉位置与文档流位置不一致，整段捕获 + 自然分页切片时容易被拦腰
 *      截断（图片顶部进上一页、底部进下一页），即"Canvas 处理不了"。
 * 这里把 img 改为 absolute、把容器上的偏移转移到 img 自身：图片脱离文档流后，
 * 文字回到 Word 中应有的位置，且 computePageBoundaries 的"跳过 absolute"
 * 分支让浮动图片不再干扰分页计算。
 * 返回被处理的图片数。
 */
function normalizeFloatingImages(section: HTMLElement): number {
  let count = 0;
  section.querySelectorAll<HTMLElement>("img").forEach((img) => {
    const parent = img.parentElement;
    if (!parent) return;
    const pcs = getComputedStyle(parent);
    // 浮动图片容器特征：relative 且 0×0（图片通过 left/top 偏移溢出显示）
    if (pcs.position !== "relative") return;
    const prect = parent.getBoundingClientRect();
    if (prect.width > 1 || prect.height > 1) return; // 内联/环绕图片容器有尺寸，不动
    if (img.getBoundingClientRect().width <= 0) return;

    // 把容器偏移 + img 自身偏移合并到 img（absolute 相对容器定位，视觉位置不变）
    const pTop = Number.parseFloat(pcs.top) || 0;
    const pLeft = Number.parseFloat(pcs.left) || 0;
    const ics = getComputedStyle(img);
    const iTop = Number.parseFloat(ics.top) || 0;
    const iLeft = Number.parseFloat(ics.left) || 0;
    parent.style.top = "0px";
    parent.style.left = "0px";
    img.style.position = "absolute";
    img.style.top = `${pTop + iTop}px`;
    img.style.left = `${pLeft + iLeft}px`;
    count++;
  });
  return count;
}

/**
 * 分页切片前，把视觉上跨越页面边界的浮动图片（absolute）钳制到其视觉中心
 * 所在页内，保证图片完整出现在某一页，避免被切片拦腰截断。
 * 必须在 computePageBoundaries 之后、捕获之前调用。
 */
function clampFloatingImages(section: HTMLElement, boundaries: number[]): void {
  const secTop = section.getBoundingClientRect().top;
  const totalH = section.offsetHeight;
  const pages = [0, ...boundaries, totalH];
  section.querySelectorAll<HTMLElement>("img").forEach((img) => {
    if (getComputedStyle(img).position !== "absolute") return;
    const r = img.getBoundingClientRect();
    const imgTop = r.top - secTop;
    const h = r.height;
    if (h <= 0) return;
    // 归属页：图片视觉中心所在页
    let idx = pages.length - 2;
    const center = imgTop + h / 2;
    for (let i = 0; i < pages.length - 1; i++) {
      if (center >= pages[i] && center < pages[i + 1]) {
        idx = i;
        break;
      }
    }
    const pageTop = pages[idx];
    const pageBottom = pages[idx + 1];
    let top = imgTop;
    if (top < pageTop) top = pageTop;
    if (top + h > pageBottom) top = pageBottom - h;
    if (top < pageTop) top = pageTop; // 单张图比整页还高时的兜底
    if (Math.abs(top - imgTop) > 0.5) {
      const curTop = Number.parseFloat(getComputedStyle(img).top) || 0;
      img.style.top = `${curTop + (top - imgTop)}px`;
    }
  });
}

/** 等待页面内所有图片加载完成并解码，避免捕获时图片缺失或空白 */
async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    imgs.map(async (img) => {
      // 1) 等 complete + naturalWidth（图片就绪）
      await new Promise<void>((resolve) => {
        if (img.complete && img.naturalWidth > 0) {
          resolve();
          return;
        }
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        // 兜底超时（大图解码慢），避免一直等待
        setTimeout(done, 15000);
      });
      // 2) 等 decode，确保像素真正可绘制，截出来不是空白
      try {
        if (img.naturalWidth > 0) {
          await img.decode();
        }
      } catch {
        // 解码失败忽略，尽量继续
      }
    }),
  );
}

/**
 * 获取页面高度（px）。docx-preview 内联 min-height 是 pt 单位（如 "792pt"），
 * 必须用 getComputedStyle 取到最终的 px 值（如 1056px），否则切片高度会算错。
 */
function getPageHeight(section: HTMLElement): number {
  const computed = Number.parseFloat(getComputedStyle(section).minHeight);
  if (computed > 0) return computed;
  const inline = Number.parseFloat(section.style.minHeight || "");
  if (inline > 0) return inline;
  return 1122; // A4 @96dpi 兜底
}

/**
 * 计算自然分页边界：docx-preview 渲染出的连续流里，按页面高度寻找"内容块起点"
 * 处断页，避免把段落 / 表格行 / 图片拦腰截断，尽可能 1:1 复刻 Word 的分页效果。
 * 返回每个新页在 section 中的起始 y 坐标。
 */
function computePageBoundaries(section: HTMLElement, pageH: number): number[] {
  const secTop = section.getBoundingClientRect().top;
  const totalH = section.offsetHeight || section.scrollHeight;

  // 收集正常流中的块元素（article 直接子元素；表格按行拆分，便于跨页断行）
  const blocks: { y: number; h: number }[] = [];
  section.querySelectorAll<HTMLElement>(":scope > article").forEach((article) => {
    Array.from(article.children).forEach((el) => {
      const child = el as HTMLElement;
      if (getComputedStyle(child).position === "absolute") return; // 浮动元素不参与分页
      if (child.tagName === "TABLE") {
        Array.from(child.querySelectorAll("tr")).forEach((tr) => {
          const r = (tr as HTMLElement).getBoundingClientRect();
          blocks.push({ y: r.top - secTop, h: r.height });
        });
      } else {
        const r = child.getBoundingClientRect();
        blocks.push({ y: r.top - secTop, h: r.height });
      }
    });
  });

  const boundaries: number[] = [];
  let pageStart = 0;
  while (pageStart + pageH < totalH - 1) {
    const pageEnd = pageStart + pageH;
    let cut = pageEnd;
    for (const b of blocks) {
      if (b.y < pageStart) continue;
      if (b.y >= pageEnd) break;
      if (b.y + b.h > pageEnd) {
        cut = b.y; // 有块会跨界 → 断在块起点
        break;
      }
    }
    if (cut <= pageStart + 0.01) cut = pageEnd; // 单个超高块兜底，直接按页高切
    boundaries.push(cut);
    pageStart = cut;
  }
  return boundaries;
}

/** 用 html2canvas 捕获为 canvas */
async function capturePageWithCanvas(section: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(section, {
    scale: PIXEL_RATIO,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
}

/** 将单个 Word 页 DOM 节点捕获为 PNG Blob（优先 html-to-image，超时/失败回退 html2canvas） */
async function capturePage(pageEl: HTMLElement): Promise<Blob> {
  try {
    const dataUrl = await withTimeout(
      toImagePng(pageEl, {
        pixelRatio: PIXEL_RATIO,
        backgroundColor: "#ffffff",
        skipFonts: true,
      }),
      15000,
      "单页捕获",
    );
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch (error) {
    logger.warn("html-to-image 捕获 Word 页失败，回退 html2canvas:", error);
    const canvas = await capturePageWithCanvas(pageEl);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas toBlob 失败"))), "image/png");
    });
  }
}

/** 将整个 section 捕获为 canvas（用于多页按自然边界切片）。优先尝试 html-to-image，失败回退 html2canvas */
async function captureSectionCanvas(section: HTMLElement): Promise<HTMLCanvasElement> {
  try {
    const canvas = await withTimeout(
      toCanvas(section, {
        pixelRatio: PIXEL_RATIO,
        backgroundColor: "#ffffff",
        skipFonts: true,
      }),
      20000,
      "整段捕获",
    );
    // 尺寸校验：canvas 高度应约等于 section 实际高度 × 倍率，异常时回退 html2canvas
    const expected = Math.round(section.offsetHeight * PIXEL_RATIO);
    if (Math.abs(canvas.height - expected) > expected * 0.1) {
      logger.warn("html-to-image 整段捕获高度异常，回退 html2canvas:", canvas.height, expected);
      return await capturePageWithCanvas(section);
    }
    return canvas;
  } catch (error) {
    logger.warn("html-to-image 整段捕获失败，回退 html2canvas:", error);
    return await capturePageWithCanvas(section);
  }
}

function makeImageData(blob: Blob, index: number): FileData {
  return {
    name: `page_${index}.png`,
    url: URL.createObjectURL(blob),
    type: "image/png",
    size: blob.size,
  };
}

/**
 * 将 .docx / 新版 .wps 文件的每一页转换为 PNG 图片（blob URL），每张图片的高度
 * 与 Word 中的一页高度一致。
 *
 * docx-preview 只在文档有分页标记时才分页；没有分页标记的长文档会渲染成单个
 * 超长 section。这里按页面高度（getPageHeight）把超长 section 切片成多张等高的
 * 页面图片，避免"前后页面粘连"与"最终图片超长"。
 *
 * 注意：捕获工具无法处理 shadow DOM 内的元素，因此渲染容器会被临时挂载到
 * document.body（light DOM）中，使用完成后移除。
 */
export async function convertDocxToImages(
  arrayBuffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void,
): Promise<DocxConvertResult> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  container.style.pointerEvents = "none";
  // 设置对中文友好的字体回退栈，避免文档指定字体缺失时回退到很差的中文字体
  container.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", "Source Han Sans SC", "Helvetica Neue", Arial, sans-serif';
  document.body.appendChild(container);

  try {
    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    await renderAsync(blob, container, container, {
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      ignoreFonts: true,
      useBase64URL: true,
      experimental: true,
    });

    const sections = Array.from(container.querySelectorAll<HTMLElement>("section.docx"));

    // 先清理不可见元素、等待图片加载、修复表格，并计算每个 section 的自然分页边界
    const pages: { section: HTMLElement; pageH: number; cuts: number[] }[] = [];
    let accumulatedPages = 0;
    for (const section of sections) {
      const secIdx = sections.indexOf(section) + 1;
      const imgsBefore = section.querySelectorAll("img").length;
      const svgsBefore = section.querySelectorAll("svg").length;
      sanitizeForCapture(section);
      const imgsAfterClean = section.querySelectorAll("img").length;
      const svgsAfterClean = section.querySelectorAll("svg").length;
      logger.debug(
        `[pupu-docx] section${secIdx} 清理前 img=${imgsBefore} svg=${svgsBefore}, 清理后 img=${imgsAfterClean} svg=${svgsAfterClean}`,
      );

      await waitForImages(section);
      const loaded = [...section.querySelectorAll<HTMLImageElement>("img")].filter(
        (im) => im.complete && im.naturalWidth > 0,
      );
      logger.debug(
        `[pupu-docx] section${secIdx} 图片详情:`,
        loaded.map((im) => ({
          w: im.naturalWidth,
          h: im.naturalHeight,
          rw: Math.round(im.getBoundingClientRect().width),
          rh: Math.round(im.getBoundingClientRect().height),
          srcLen: (im.src || "").length,
        })),
      );

      fixTableCells(section);
      // 让"浮于文字上方/下方"的浮动图片脱离文档流（absolute）：否则图片会把所在
      // 段落撑高、顶得后续文字下移，且视觉位置与文档流位置不一致，切片时被拦腰截断
      const floatingFixed = normalizeFloatingImages(section);
      const totalH = section.offsetHeight || section.scrollHeight;
      const pageH = getPageHeight(section);
      const boundaries = computePageBoundaries(section, pageH);
      // 把视觉上跨页的浮动图片钳制到归属页内，保证图片完整出现在某一页
      clampFloatingImages(section, boundaries);
      const cuts = boundaries.length > 0 ? [0, ...boundaries, totalH] : [0, totalH];
      logger.debug(
        `[pupu-docx] section${secIdx} pageH=${pageH.toFixed(1)} totalH=${totalH} 边界=${JSON.stringify(boundaries)} 页数=${cuts.length - 1} 浮动图片=${floatingFixed}`,
      );
      // 限制总转换页数：超过 MAX_PAGES 时截断当前 section，并跳过后续 section
      const remaining = MAX_PAGES - accumulatedPages;
      if (remaining <= 0) {
        break;
      }
      if (cuts.length - 1 > remaining) {
        const limitedCuts = cuts.slice(0, remaining + 1);
        accumulatedPages += limitedCuts.length - 1;
        logger.debug(
          `[pupu-docx] section${secIdx} 超过上限，仅保留前 ${limitedCuts.length - 1} 页（共 ${cuts.length - 1} 页）`,
        );
        pages.push({ section, pageH, cuts: limitedCuts });
        break;
      }
      accumulatedPages += cuts.length - 1;
      pages.push({ section, pageH, cuts });
    }
    const totalPages = pages.reduce((sum, p) => sum + (p.cuts.length - 1), 0);

    const images: FileData[] = [];
    const imgTags: string[] = [];
    let done = 0;

    for (const { section, pageH, cuts } of pages) {
      if (cuts.length === 2 && cuts[1] <= pageH + 2) {
        // 单页：直接捕获
        const pageBlob = await capturePage(section);
        done += 1;
        const file = makeImageData(pageBlob, done);
        images.push(file);
        imgTags.push(`<p><img src="${file.url}" alt="page-${done}" /></p>`);
        onProgress?.(done, totalPages);
        continue;
      }

      // 多页：整段捕获到 canvas，按自然分页边界切片，并补白到 Word 页高
      const canvas = await captureSectionCanvas(section);
      const ratio = canvas.width / (section.offsetWidth || 1);
      const pageHpx = Math.max(1, Math.round(pageH * ratio));
      for (let s = 0; s < cuts.length - 1; s++) {
        const y0 = Math.round(cuts[s] * ratio);
        const y1 = Math.round(cuts[s + 1] * ratio);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = pageHpx; // 补白到 Word 页高
        const ctx = sliceCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          const ch = Math.min(y1 - y0, pageHpx);
          ctx.drawImage(canvas, 0, y0, canvas.width, ch, 0, 0, canvas.width, ch);
        }
        const pageBlob = await new Promise<Blob>((resolve, reject) => {
          sliceCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas toBlob 失败"))), "image/png");
        });
        done += 1;
        const file = makeImageData(pageBlob, done);
        images.push(file);
        imgTags.push(`<p><img src="${file.url}" alt="page-${done}" /></p>`);
        onProgress?.(done, totalPages);
      }
    }

    return { images, html: imgTags.join(""), pageCount: totalPages };
  } finally {
    container.remove();
  }
}

interface PreparedDocxPage {
  section: HTMLElement;
  pageH: number;
  cuts: number[];
}

/**
 * 渲染后计算 docx 各 section 的自然分页切片。与 convertDocxToImages 的分页逻辑一致：
 * 清理不可见元素、等待图片加载、修复表格、处理浮动图片、按页高切片、限制总页数。
 */
async function computeDocxPages(container: HTMLElement): Promise<PreparedDocxPage[]> {
  const sections = Array.from(container.querySelectorAll<HTMLElement>("section.docx"));
  const pages: PreparedDocxPage[] = [];
  let accumulatedPages = 0;
  for (const section of sections) {
    const secIdx = sections.indexOf(section) + 1;
    const imgsBefore = section.querySelectorAll("img").length;
    const svgsBefore = section.querySelectorAll("svg").length;
    sanitizeForCapture(section);
    const imgsAfterClean = section.querySelectorAll("img").length;
    const svgsAfterClean = section.querySelectorAll("svg").length;
    logger.debug(
      `[pupu-docx] section${secIdx} 清理前 img=${imgsBefore} svg=${svgsBefore}, 清理后 img=${imgsAfterClean} svg=${svgsAfterClean}`,
    );

    await waitForImages(section);
    const loaded = [...section.querySelectorAll<HTMLImageElement>("img")].filter(
      (im) => im.complete && im.naturalWidth > 0,
    );
    logger.debug(
      `[pupu-docx] section${secIdx} 图片详情:`,
      loaded.map((im) => ({
        w: im.naturalWidth,
        h: im.naturalHeight,
        rw: Math.round(im.getBoundingClientRect().width),
        rh: Math.round(im.getBoundingClientRect().height),
        srcLen: (im.src || "").length,
      })),
    );

    fixTableCells(section);
    const floatingFixed = normalizeFloatingImages(section);
    const totalH = section.offsetHeight || section.scrollHeight;
    const pageH = getPageHeight(section);
    const boundaries = computePageBoundaries(section, pageH);
    clampFloatingImages(section, boundaries);
    const cuts = boundaries.length > 0 ? [0, ...boundaries, totalH] : [0, totalH];
    logger.debug(
      `[pupu-docx] section${secIdx} pageH=${pageH.toFixed(1)} totalH=${totalH} 边界=${JSON.stringify(boundaries)} 页数=${cuts.length - 1} 浮动图片=${floatingFixed}`,
    );
    const remaining = MAX_PAGES - accumulatedPages;
    if (remaining <= 0) {
      break;
    }
    if (cuts.length - 1 > remaining) {
      const limitedCuts = cuts.slice(0, remaining + 1);
      accumulatedPages += limitedCuts.length - 1;
      logger.debug(
        `[pupu-docx] section${secIdx} 超过上限，仅保留前 ${limitedCuts.length - 1} 页（共 ${cuts.length - 1} 页）`,
      );
      pages.push({ section, pageH, cuts: limitedCuts });
      break;
    }
    accumulatedPages += cuts.length - 1;
    pages.push({ section, pageH, cuts });
  }
  return pages;
}

/** 将逐页捕获的 canvas 拼接为多页 PDF（jsPDF），返回 PDF 的 ArrayBuffer */
async function canvasesToPdf(canvases: HTMLCanvasElement[]): Promise<ArrayBuffer> {
  if (canvases.length === 0) {
    throw new Error("docx 转 PDF 失败：未捕获到任何页面");
  }
  const w = canvases[0].width;
  const h = canvases[0].height;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [w, h],
    compress: true,
  });
  canvases.forEach((canvas, i) => {
    if (i > 0) {
      pdf.addPage([w, h], "portrait");
    }
    // 不同页尺寸略有差异时按比例缩放并居中，白底填充
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.min(w / cw, h / ch);
    const dw = cw * scale;
    const dh = ch * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", dx, dy, dw, dh);
  });
  const blob = pdf.output("blob");
  return await blob.arrayBuffer();
}

/**
 * 将 .docx / 新版 .wps 文件转换为 PDF（ArrayBuffer）。
 *
 * 转换路径：docx-preview 渲染成 HTML → 按 Word 页高切分并逐页捕获为 canvas →
 * jsPDF 拼接为多页 PDF。之后再交给 convertPdfToImages 逐页转图片，保证页面
 * 边界由 PDF 一页一图决定，避免直接对渲染 HTML 切片时把内容拦腰截断。
 * onProgress 在每页捕获完成后回调 (current, totalPages)。
 */
export async function convertDocxToPdf(
  arrayBuffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void,
): Promise<ArrayBuffer> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  container.style.pointerEvents = "none";
  container.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", "Source Han Sans SC", "Helvetica Neue", Arial, sans-serif';
  document.body.appendChild(container);

  try {
    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await renderAsync(blob, container, container, {
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      ignoreFonts: true,
      useBase64URL: true,
      experimental: true,
    });

    const pages = await computeDocxPages(container);
    const totalPages = pages.reduce((sum, p) => sum + (p.cuts.length - 1), 0);
    const canvases: HTMLCanvasElement[] = [];

    for (const { section, pageH, cuts } of pages) {
      if (cuts.length === 2 && cuts[1] <= pageH + 2) {
        // 单页：直接捕获整段
        canvases.push(await captureSectionCanvas(section));
        onProgress?.(canvases.length, totalPages);
      } else {
        // 多页：整段捕获到 canvas，按自然分页边界切片，并补白到 Word 页高
        const canvas = await captureSectionCanvas(section);
        const ratio = canvas.width / (section.offsetWidth || 1);
        const pageHpx = Math.max(1, Math.round(pageH * ratio));
        for (let s = 0; s < cuts.length - 1; s++) {
          const y0 = Math.round(cuts[s] * ratio);
          const y1 = Math.round(cuts[s + 1] * ratio);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = pageHpx;
          const ctx = sliceCanvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            const ch = Math.min(y1 - y0, pageHpx);
            ctx.drawImage(canvas, 0, y0, canvas.width, ch, 0, 0, canvas.width, ch);
          }
          canvases.push(sliceCanvas);
          onProgress?.(canvases.length, totalPages);
        }
      }
    }

    return await canvasesToPdf(canvases);
  } finally {
    container.remove();
  }
}
