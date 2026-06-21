import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function useIsDark() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isDark = mounted && (theme === "system" ? resolvedTheme : theme) === "dark";
  return { mounted, isDark };
}
