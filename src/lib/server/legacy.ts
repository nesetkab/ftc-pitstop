const EVENT_CODE = /^[A-Za-z0-9]{2,24}$/;
const TEAM_NUMBER = /^[1-9]\d{0,4}$/;

const EVENT_PAGES = new Map([
	['event', ''],
	['bracket', '/playoffs'],
	['comparison', '/teams'],
	['predictions', '/schedule']
]);

export function legacyRedirect(pathname: string): string | null {
	const parts = pathname.split('/').filter(Boolean);
	const [section, first, second] = parts;
	if (section === 'dashboard') {
		if (parts.length === 1) return '/';
		if (parts.length === 3 && EVENT_CODE.test(first) && TEAM_NUMBER.test(second)) {
			return `/${second}?event=${first.toUpperCase()}`;
		}
		return null;
	}
	if (section === 'scout') return '/w';
	const page = EVENT_PAGES.get(section);
	if (page !== undefined && parts.length === 2 && EVENT_CODE.test(first)) {
		return `/events/${first.toUpperCase()}${page}`;
	}
	return null;
}
