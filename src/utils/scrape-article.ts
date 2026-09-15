import { Readability } from "@mozilla/readability";
import { preprocessor } from "~contents/scraper/preprocessor";

export interface ImportedArticleData {
  title: string;
  author: string;
  cover: string;
  content: string;
  digest: string;
}

function resolveUrl(value: string | null, baseUrl: string) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function normalizeDocumentUrls(doc: Document, baseUrl: string) {
  const attributes: Array<[string, string]> = [
    ["img", "src"],
    ["img", "data-src"],
    ["source", "src"],
    ["video", "src"],
    ["video", "poster"],
    ["a", "href"],
  ];

  attributes.forEach(([selector, attribute]) => {
    doc.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      const resolvedValue = resolveUrl(element.getAttribute(attribute), baseUrl);
      if (resolvedValue) {
        element.setAttribute(attribute, resolvedValue);
      }
    });
  });
}

function getMetaContent(doc: Document, selector: string) {
  return doc.querySelector(selector)?.getAttribute("content")?.trim() || "";
}

export async function scrapeArticleFromUrl(sourceUrl: string): Promise<ImportedArticleData> {
  const response = await fetch(sourceUrl, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.status}`);
  }

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const finalUrl = response.url || sourceUrl;

  normalizeDocumentUrls(doc, finalUrl);

  const article = new Readability(doc.cloneNode(true) as Document).parse();
  if (!article?.title || !article.content) {
    throw new Error("Failed to extract article content");
  }

  return {
    title: article.title.trim(),
    author:
      getMetaContent(doc, 'meta[name="author"]') ||
      getMetaContent(doc, 'meta[property="article:author"]') ||
      getMetaContent(doc, 'meta[property="og:author"]'),
    cover: getMetaContent(doc, 'meta[property="og:image"]')
      ? resolveUrl(getMetaContent(doc, 'meta[property="og:image"]'), finalUrl)
      : "",
    content: preprocessor(article.content.trim()),
    digest: (article.excerpt || "").trim(),
  };
}
