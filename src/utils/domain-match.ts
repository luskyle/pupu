// 可信域名匹配：内容脚本（页面侧）与后台都依赖它来判定某个站点是否有权调用扩展能力，
// 因此必须是纯函数、可单测，并且严格区分同后缀但不同域的域名
// （例如信任 `*.example.com` 时绝不能让 `evilexample.com` 通过）。

/** 从 URL / origin 中取 hostname；解析失败返回空字符串。 */
export const hostnameOf = (input: string): string => {
  try {
    return new URL(input).hostname;
  } catch {
    return "";
  }
};

/**
 * 判断 hostname 是否命中可信域名列表。
 *
 * 通配符 `*.example.com` 要求子域点边界：`example.com` 本身与 `a.example.com` 命中；
 * `evilexample.com`、`notexample.com`、`example.com.evil.com` 一律不命中。
 */
export const isHostnameTrusted = (hostname: string, trustedDomains: readonly { domain: string }[]): boolean => {
  const host = hostnameOf(hostname) || hostname.trim().toLowerCase();
  if (!host) {
    return false;
  }

  return trustedDomains.some(({ domain }) => {
    const pattern = domain.trim().toLowerCase();
    if (!pattern) {
      return false;
    }

    if (pattern.startsWith("*.")) {
      const base = pattern.slice(2);
      if (!base) {
        return false;
      }
      return host === base || host.endsWith(`.${base}`);
    }

    return host === pattern;
  });
};
