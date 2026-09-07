import { useThemeContext } from '@/store/ThemeContext';

export function useSettings() {
  const { theme, currency, loading, setTheme, setCurrency } = useThemeContext();
  return { theme, currency, loading, setTheme, setCurrency };
}
