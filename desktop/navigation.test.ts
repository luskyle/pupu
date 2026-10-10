// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isEditorPreparationNavigation } from "./navigation";
const current = "https://creator.xiaohongshu.com/publish/publish?target=video";
describe("平台准备阶段导航", () => {
  it("准备阶段允许真实平台图文切换的查询参数与 hash 更新", () => {
    expect(isEditorPreparationNavigation(current, `${current.replace("video", "image")}&from=tab_switch`, true)).toBe(
      true,
    );
    expect(isEditorPreparationNavigation(current, `${current}#image`, true)).toBe(true);
  });
  it("填写后不允许导航继续使用旧目标", () => {
    expect(isEditorPreparationNavigation(current, current.replace("video", "image"), false)).toBe(false);
  });
  it("登录页、其他编辑路径、外站导航不按正常图文切换处理", () => {
    for (const next of [
      "https://creator.xiaohongshu.com/login",
      "https://creator.xiaohongshu.com/new/note-manager",
      "https://www.xiaohongshu.com/publish/publish",
      "https://example.com/publish/publish",
    ]) {
      expect(isEditorPreparationNavigation(current, next, true)).toBe(false);
    }
  });
});
