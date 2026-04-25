// @ts-nocheck

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'idev-theme';
const DEFAULT_THEME: Theme = 'light';

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = saved ?? DEFAULT_THEME;
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  return (
    <button
      onClick={toggle}
      className={`w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted hover:text-accent hover:border-accent transition ${className}`}
      title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      aria-label="Переключить тему"
    >
      {theme === 'dark' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      )}
    </button>
  );
}

export const themeInitScript = `(function(){
  var t = localStorage.getItem('idev-theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
})();`;
