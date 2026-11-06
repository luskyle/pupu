import { afterEach, describe, expect, it, vi } from "vitest";

const pdfModules = vi.hoisted(() => {
  const createModule = () => ({
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: vi.fn(() => ({
      promise: Promise.resolve({ numPages: 0 }),
      destroy: vi.fn(async () => {}),
    })),
  });
  return { modern: createModule(), legacy: createModule() };
});

vi.mock("pdfjs-dist", () => pdfModules.modern);
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => pdfModules.legacy);

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("PDF browser compatibility", () => {
  it.each([
    ["Firefox", true, "legacy"],
    ["Chromium", false, "modern"],
  ] as const)("uses the %s-compatible PDF engine", async (_name, firefox, engine) => {
    vi.stubGlobal("browser", firefox ? { runtime: { getBrowserInfo: vi.fn() } } : undefined);
    vi.stubGlobal("chrome", { runtime: { getURL: (file: string) => `extension://${file}` } });
    const { convertPdfToImages } = await import("./pdf");

    await expect(convertPdfToImages(new ArrayBuffer(0))).resolves.toEqual({ images: [], html: "", pageCount: 0 });
    expect(pdfModules[engine].getDocument).toHaveBeenCalledOnce();
    expect(pdfModules[engine].GlobalWorkerOptions.workerSrc).toBe("extension://pdf.worker.min.mjs");
    expect(pdfModules[engine].getDocument).toHaveBeenCalledWith(
      expect.objectContaining({ wasmUrl: "extension://wasm/" }),
    );
    expect(pdfModules[engine === "legacy" ? "modern" : "legacy"].getDocument).not.toHaveBeenCalled();
  });
});
