import { useThemeContext } from '@/store/ThemeContext';

export function useTheme() {
  return useThemeContext().colors;
}
