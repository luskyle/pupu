import { describe, expect, it } from "vitest";
import { hostnameOf, isHostnameTrusted } from "~utils/domain-match";

const domains = (...list: string[]) => list.map((domain) => ({ domain }));

describe("isHostnameTrusted", () => {
  describe("精确域名", () => {
    it("命中完全相同的主机名", () => {
      expect(isHostnameTrusted("pupu.app", domains("pupu.app"))).toBe(true);
    });

    it("不命中同后缀但不同的域名", () => {
      expect(isHostnameTrusted("evilpupu.app", domains("pupu.app"))).toBe(false);
      expect(isHostnameTrusted("notpupu.app", domains("pupu.app"))).toBe(false);
    });

    it("不把子域当作已信任（精确匹配不含子域）", () => {
      expect(isHostnameTrusted("a.pupu.app", domains("pupu.app"))).toBe(false);
    });
  });

  describe("通配符子域", () => {
    const wildcard = domains("*.pupu.app");

    it("命中域名本身", () => {
      expect(isHostnameTrusted("pupu.app", wildcard)).toBe(true);
    });

    it("命中子域与多级子域", () => {
      expect(isHostnameTrusted("a.pupu.app", wildcard)).toBe(true);
      expect(isHostnameTrusted("a.b.pupu.app", wildcard)).toBe(true);
    });

    it("不命中同后缀的其它域名（点边界必须存在）", () => {
      expect(isHostnameTrusted("evilpupu.app", wildcard)).toBe(false);
      expect(isHostnameTrusted("notpupu.app", wildcard)).toBe(false);
      expect(isHostnameTrusted("evil-pupu.app", wildcard)).toBe(false);
    });

    it("不命中把已信任域当作后缀前缀的域名", () => {
      expect(isHostnameTrusted("pupu.app.evil.com", wildcard)).toBe(false);
      expect(isHostnameTrusted("evil.com/pupu.app", wildcard)).toBe(false);
    });
  });

  describe("边界与健壮性", () => {
    it("空列表一律不信任", () => {
      expect(isHostnameTrusted("pupu.app", [])).toBe(false);
    });

    it("空 / 空白主机名一律不信任", () => {
      expect(isHostnameTrusted("", domains("pupu.app"))).toBe(false);
      expect(isHostnameTrusted("   ", domains("*.pupu.app"))).toBe(false);
    });

    it("忽略空白域名条目，且裸 `*.` 不会匹配一切", () => {
      expect(isHostnameTrusted("pupu.app", domains("", "  "))).toBe(false);
      expect(isHostnameTrusted("pupu.app", domains("*."))).toBe(false);
      expect(isHostnameTrusted("anything.com", domains("*."))).toBe(false);
    });

    it("大小写不敏感", () => {
      expect(isHostnameTrusted("PUPU.APP", domains("pupu.app"))).toBe(true);
      expect(isHostnameTrusted("pupu.app", domains("PUPU.APP"))).toBe(true);
      expect(isHostnameTrusted("A.pupu.app", domains("*.PUPU.app"))).toBe(true);
    });

    it("也接受完整 URL / origin 形式的输入", () => {
      expect(isHostnameTrusted("https://pupu.app/page?x=1", domains("pupu.app"))).toBe(true);
      expect(isHostnameTrusted("https://evilpupu.app/x", domains("*.pupu.app"))).toBe(false);
    });

    it("多条目列表中任意一条命中即通过", () => {
      const list = domains("a.com", "*.b.com");
      expect(isHostnameTrusted("a.com", list)).toBe(true);
      expect(isHostnameTrusted("x.b.com", list)).toBe(true);
      expect(isHostnameTrusted("c.com", list)).toBe(false);
    });
  });
});

describe("hostnameOf", () => {
  it("从 URL / origin 中取出主机名", () => {
    expect(hostnameOf("https://pupu.app/a/b?c=1")).toBe("pupu.app");
    expect(hostnameOf("http://localhost:3000/x")).toBe("localhost");
    expect(hostnameOf("chrome-extension://abc/x.html")).toBe("abc");
  });

  it("无法解析时返回空字符串", () => {
    expect(hostnameOf("pupu.app")).toBe("");
    expect(hostnameOf("")).toBe("");
  });
});
