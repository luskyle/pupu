// 小红书文案格式规则的单测：这些规则原先内联在发布流程里、无法测试。
// 除覆盖正确行为外，也把「已知的非幂等」显式记录下来，避免今后被无意改变或误判为回归。
import { describe, expect, it } from "vitest";
import { XHS_TITLE_MAX_LENGTH, buildXhsContent, pickXhsTitle, toXhsTopic } from "~utils/rednote-text";

describe("toXhsTopic", () => {
  it("把 #话题# 转为 #话题[话题]#", () => {
    expect(toXhsTopic("#今日好物#")).toBe("#今日好物[话题]#");
  });

  it("支持一段文本里的多个话题", () => {
    expect(toXhsTopic("开头 #好物# 中间 #旅行# 结尾")).toBe("开头 #好物[话题]# 中间 #旅行[话题]# 结尾");
  });

  it("话题名含空白时不转换（与原实现保持一致）", () => {
    expect(toXhsTopic("#今日 好物#")).toBe("#今日 好物#");
    expect(toXhsTopic("#上\n行#")).toBe("#上\n行#");
  });

  it("空话题 ## 不转换", () => {
    expect(toXhsTopic("##")).toBe("##");
  });

  it("没有话题时原样返回", () => {
    expect(toXhsTopic("普通正文，没有话题")).toBe("普通正文，没有话题");
    expect(toXhsTopic("")).toBe("");
  });

  it("单个 # 不成对时不转换", () => {
    expect(toXhsTopic("#未闭合")).toBe("#未闭合");
  });

  it("支持 emoji / 中英混合话题名", () => {
    expect(toXhsTopic("#好物🎁#")).toBe("#好物🎁[话题]#");
    expect(toXhsTopic("#AI绘画#")).toBe("#AI绘画[话题]#");
  });

  it("已知非幂等：对已转换过的文本再次调用会重复追加", () => {
    // 记录既有行为：正则会把 `#a[话题]#` 整体视为一个 `#...#` 话题。
    // 实际发布流程每次都用原始 content 转换一次，因此不会触发；此处仅作显式记录。
    expect(toXhsTopic("#a[话题]#")).toBe("#a[话题][话题]#");
  });
});

describe("pickXhsTitle", () => {
  it("优先使用显式标题", () => {
    expect(pickXhsTitle("我的标题", "正文首行\n第二行")).toBe("我的标题");
  });

  it("无显式标题时退化为正文首行", () => {
    expect(pickXhsTitle("", "正文首行\n第二行")).toBe("正文首行");
    expect(pickXhsTitle(undefined, "正文首行\n第二行")).toBe("正文首行");
  });

  it("标题恰好等于上限时保留", () => {
    const justFit = "字".repeat(XHS_TITLE_MAX_LENGTH);
    expect(pickXhsTitle(justFit)).toBe(justFit);
  });

  it("标题超过上限时返回空串（跳过填充而不是截断）", () => {
    const tooLong = "字".repeat(XHS_TITLE_MAX_LENGTH + 1);
    expect(pickXhsTitle(tooLong)).toBe("");
    expect(pickXhsTitle(tooLong)).not.toContain("字");
  });

  it("正文首行超长同样跳过标题", () => {
    const tooLong = "字".repeat(XHS_TITLE_MAX_LENGTH + 1);
    expect(pickXhsTitle(undefined, `${tooLong}\n短行`)).toBe("");
  });

  it("标题里的话题也会被转换", () => {
    expect(pickXhsTitle("#好物#")).toBe("#好物[话题]#");
  });

  it("既无标题也无正文时返回空串", () => {
    expect(pickXhsTitle(undefined, undefined)).toBe("");
    expect(pickXhsTitle("", "")).toBe("");
  });

  it("上限常量为 20（与平台限制一致）", () => {
    expect(XHS_TITLE_MAX_LENGTH).toBe(20);
  });
});

describe("buildXhsContent", () => {
  it("只有正文时转换正文内的话题", () => {
    expect(buildXhsContent("#好物# 正文", undefined)).toBe("#好物[话题]# 正文");
  });

  it("把 tags 以 #标签# 追加到正文末尾并一起转换", () => {
    expect(buildXhsContent("正文", ["旅行", "美食"])).toBe("正文 #旅行[话题]# #美食[话题]#");
  });

  it("没有正文但有 tags 时保留前导空格（既有行为）", () => {
    expect(buildXhsContent("", ["旅行"])).toBe(" #旅行[话题]#");
  });

  it("正文与 tags 都为空时返回空串", () => {
    expect(buildXhsContent(undefined, undefined)).toBe("");
    expect(buildXhsContent("", [])).toBe("");
  });
});
