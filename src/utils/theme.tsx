import { Storage } from "@plasmohq/storage";
import { useStorage } from "@plasmohq/storage/hook";
import { type ReactNode, createContext, useContext, useEffect } from "react";

export const THEME_STORAGE_KEY = "appTheme";

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
}

const storage = new Storage({ area: "local" });

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  toggleTheme: () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * 主题提供者：默认暗色主题，切换结果持久化到本地存储。
 * 会为子节点包一层容器，并依据主题切换 `dark` 类，供 Tailwind / HeroUI 暗色样式使用。
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [storedTheme, setStoredTheme] = useStorage<"dark" | "light">({
    key: THEME_STORAGE_KEY,
    instance: storage,
  });

  // 默认暗色主题（storedTheme 为 undefined 时视为暗色）
  const isDark = storedTheme !== "light";

  const toggleTheme = () => {
    void setStoredTheme(isDark ? "light" : "dark");
  };

  // 同步 dark 类到 document 根节点，保证页面中其他挂载点（如弹层）也能跟随主题
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document.body.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <div className={isDark ? "dark" : ""}>{children}</div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
