export type Theme = 'system' | 'light' | 'dark';

export const THEME_KEY = 'ps-theme';

export const theme = $state<{ current: Theme }>({ current: 'system' });

function isTheme(value: unknown): value is Theme {
	return value === 'system' || value === 'light' || value === 'dark';
}

export function readTheme(): Theme {
	try {
		const stored = localStorage.getItem(THEME_KEY);
		return isTheme(stored) ? stored : 'system';
	} catch {
		return 'system';
	}
}

function store(value: Theme) {
	try {
		if (value === 'system') localStorage.removeItem(THEME_KEY);
		else localStorage.setItem(THEME_KEY, value);
	} catch {
		return;
	}
}

export function setTheme(value: Theme) {
	theme.current = value;
	const root = document.documentElement;
	if (value === 'system') delete root.dataset.theme;
	else root.dataset.theme = value;
	store(value);
}
