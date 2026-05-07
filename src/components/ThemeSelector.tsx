interface ThemeSelectorProps {
  value: 'light' | 'dark' | 'system';
  onChange: (value: 'light' | 'dark' | 'system') => void;
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  return (
    <div className="theme-selector" role="radiogroup" aria-label="Theme">
      <button
        type="button"
        className={`theme-selector-btn ${value === 'light' ? 'theme-selector-btn--active' : ''}`}
        onClick={() => onChange('light')}
        role="radio"
        aria-checked={value === 'light'}
        title="Light"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      </button>
      <button
        type="button"
        className={`theme-selector-btn ${value === 'dark' ? 'theme-selector-btn--active' : ''}`}
        onClick={() => onChange('dark')}
        role="radio"
        aria-checked={value === 'dark'}
        title="Dark"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </button>
      <button
        type="button"
        className={`theme-selector-btn ${value === 'system' ? 'theme-selector-btn--active' : ''}`}
        onClick={() => onChange('system')}
        role="radio"
        aria-checked={value === 'system'}
        title="System"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </button>
    </div>
  );
}

export function getInitialTheme(): 'light' | 'dark' | 'system' {
  if (document.documentElement.classList.contains('dark')) {
    return 'dark';
  }
  if (document.documentElement.classList.contains('light')) {
    return 'light';
  }
  return 'system';
}