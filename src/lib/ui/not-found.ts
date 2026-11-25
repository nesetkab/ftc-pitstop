const CODE = /^[A-Za-z0-9]{2,16}$/;
const NUMBER = /^\d{1,6}$/;

export interface MissingPage {
	title: string;
	meta: string;
	back: { href: string; label: string } | null;
}

export function missingEvent(
	route: string,
	params: { code?: string; key?: string; number?: string }
): MissingPage {
	const code = params.code ?? '';
	const event = CODE.test(code) ? code.toUpperCase() : null;
	const back = event ? { href: `/events/${event}`, label: 'Back to the event' } : null;
	if (route.includes('/matches/')) {
		const key = params.key ?? '';
		return {
			title: 'Match not found',
			meta: CODE.test(key)
				? `This event has no match ${key.toUpperCase()}.`
				: 'This event has no such match.',
			back
		};
	}
	if (route.includes('/teams/')) {
		const number = params.number ?? '';
		return {
			title: 'Team not found at this event',
			meta: NUMBER.test(number)
				? `Team ${number} isn't on the list for this event.`
				: "That team isn't on the list for this event.",
			back: back && { href: `${back.href}/teams`, label: 'Teams at this event' }
		};
	}
	return {
		title: 'Event not found',
		meta: event ? `No event has the code ${event}.` : 'There is no event at this address.',
		back: null
	};
}

export function missingTeam(input: string | number | undefined): string {
	const number = input === undefined ? '' : String(input);
	return NUMBER.test(number)
		? `No team has the number ${number}.`
		: 'There is no team at this address.';
}
