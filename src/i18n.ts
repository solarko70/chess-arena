/**
 * Minimal internationalization (i18n) layer.
 * Currently supports Russian strings with key fallback.
 */
export const translations: Record<string, string> = {
  'menu.playLocal': 'Играть локально',
  'menu.playBot': 'Играть с ботом',
  'menu.playOnline': 'Играть по сети',
  'menu.playVariants': 'Играть в вариации',
  'menu.analysis': 'Анализ',
  'common.soon': 'Скоро',
  'common.themeToggleDark': '🌙 Тёмная тема',
  'common.themeToggleLight': '☀️ Светлая тема',
  'header.backToMain': '← На главный',
  'game.leaveConfirm': 'Партия будет потеряна',
};

export function t(key: string): string {
  return translations[key] ?? key;
}

