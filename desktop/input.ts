import { parseSettings } from "../src/agent/decision";

export interface FillRequest {
  title: string;
  content: string;
  model: string;
  upload: boolean;
}

export function parseFillRequest(value: unknown): FillRequest {
  if (
    !value ||
    typeof value !== "object" ||
    !("title" in value) ||
    typeof value.title !== "string" ||
    !("content" in value) ||
    typeof value.content !== "string" ||
    !("model" in value) ||
    typeof value.model !== "string" ||
    ("upload" in value && typeof value.upload !== "boolean")
  ) {
    throw new Error("填写任务格式无效");
  }
  if (!value.title.trim() || value.title.length > 20) throw new Error("试点标题需要 1–20 个字符；不会自动截断或改写");
  if (value.content.length > 10_000) throw new Error("正文超过试点支持范围");
  return {
    title: value.title,
    content: value.content,
    model: parseSettings({ enabled: true, model: value.model }).model,
    upload: "upload" in value && value.upload === true,
  };
}
