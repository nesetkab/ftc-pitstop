import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { replayBundle, replayStart, selectionWindow } from '#lib/game/replay.ts';
import { fixtureBundle } from './fixtures.ts';
import PhoneScreen from './PhoneScreen.svelte';
import { DEFAULT_ALERTS } from './alerts.ts';
import { queueCall } from './queue.ts';
import TvScreen from './TvScreen.svelte';
import { pitView, sideOf } from './view.ts';

const TEAM = 14624;
const full = fixtureBundle('USAZGIQ');
const at = (label: string) => replayStart(label, full)!;
const match = (key: string) => full.matches.find((item) => item.key === key)!;

function props(time: number, extra: Record<string, unknown> = {}) {
	const bundle = replayBundle(full, time);
	const view = pitView({ bundle, analysis: null, queue: null, team: TEAM });
	const call = queueCall(view.next, time);
	return {
		view,
		event: bundle.event,
		now: time,
		call,
		takeover: null,
		connection: 'connected' as const,
		updated: bundle.fetchedAt,
		source: bundle.source,
		stale: false,
		phoneUrl: 'ftcpitstop.com/14624',
		...extra
	};
}

const text = (container: HTMLElement) => container.textContent?.replace(/\s+/g, ' ') ?? '';

afterEach(() => cleanup());

describe('TvScreen', () => {
	it('shows the QR code and first match before the event starts', () => {
		const { container } = render(TvScreen, {
			props: props(Date.parse('2026-11-14T17:00:00Z'))
		});
		expect(container.querySelector('[data-phase="upcoming"]')).not.toBeNull();
		expect(
			screen.getByRole('img', { name: 'QR code for ftcpitstop.com/14624' })
		).toBeInTheDocument();
		expect(text(container)).toContain('First match Q5 at 10:56 AM');
		expect(text(container)).not.toContain('The match schedule');
		expect(text(container)).toContain('Red alliance with 15058.');
		expect(text(container)).toContain('ftcpitstop.com/14624');
		expect(text(container)).toContain('Matches start at 10:30 AM.');
	});

	it('names the team and each panel with headings', () => {
		render(TvScreen, { props: props(at('Q22')) });
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(String(TEAM));
		const headings = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);
		expect(headings).toContain('Next match');
		expect(headings).toContain('Our matches');
	});

	it('keeps the phone address short enough to fit under the QR code', () => {
		const { container } = render(TvScreen, {
			props: props(Date.parse('2026-11-14T17:00:00Z'), { phoneUrl: 'www.ftcpitstop.com/14624' })
		});
		expect(container.querySelector('.url')?.textContent).toBe('ftcpitstop.com/14624');
		expect(
			screen.getByRole('img', { name: 'QR code for www.ftcpitstop.com/14624' })
		).toBeInTheDocument();
	});

	it('says which day the first match is when it is not today', () => {
		const evening = Date.parse('2026-11-13T22:00:00Z');
		const { container } = render(TvScreen, { props: props(evening) });
		const content = text(container);
		expect(content).toContain('First match tomorrow Q5 at 10:56 AM');
		expect(content).toContain('Matches start tomorrow at 10:30 AM.');
		cleanup();
		const phone = render(PhoneScreen, {
			props: {
				...props(evening),
				matches: replayBundle(full, evening).matches,
				alerts: DEFAULT_ALERTS,
				permission: 'default' as const
			}
		});
		expect(text(phone.container)).toContain('First match tomorrow Q5');
	});

	it('lays out qualifications like the spec', () => {
		const { container } = render(TvScreen, { props: props(at('Q22')) });
		const content = text(container);
		expect(container.querySelector('[data-phase="quals"]')).not.toBeNull();
		expect(content).toContain('Next match');
		expect(content).toContain('Q26');
		expect(content).toContain('Red alliance');
		expect(content).toContain('Scheduled for 1:58 PM');
		expect(content).toContain('3 matches from now. The field is running 2 minutes behind.');
		expect(content).toContain('Rankings after Q22');
		expect(content).toContain('Teams and rank');
		expect(content).not.toContain('Win chance');
		const mine = [...container.querySelectorAll('tr.me td')].map((cell) => cell.textContent);
		expect(mine).toEqual(['8', '14624', 'Cat-Astrophic Byte', '3.33', '3-0-0']);
		expect(container.querySelectorAll('table tbody tr')).toHaveLength(27);
		expect(content).toContain('Q22 Blue won 26670, 18421 97–45');
		expect(content).toContain('Connected');
		expect(content).toContain('Updated 1:39:30 PM from FTC Events');
		expect(content).toContain('Q23 is next');
		expect(content).toContain('14624 Cat-Astrophic Byte');
	});

	it('takes over the screen at queue time until tapped', async () => {
		const time = match('q23').actualTime!;
		const base = props(time);
		const ondismiss = vi.fn();
		const { container } = render(TvScreen, {
			props: { ...base, takeover: base.call, ondismiss }
		});
		const takeover = screen.getByRole('button', { name: /Queue now/ });
		expect(takeover.textContent?.replace(/\s+/g, ' ')).toContain('Queue now Q26, red alliance');
		expect(text(container)).toContain('Q23 is on the field');
		await fireEvent.click(takeover);
		expect(ondismiss).toHaveBeenCalledOnce();
	});

	it('warns when the data is stale', () => {
		const { container } = render(TvScreen, {
			props: props(at('Q22'), { stale: true, connection: 'retrying', now: at('Q22') + 240_000 })
		});
		expect(container.querySelector('footer.stale')).not.toBeNull();
		expect(text(container)).toContain('Reconnecting');
		expect(text(container)).toContain('4 minutes ago');
	});

	it('follows alliance selection', () => {
		const window = selectionWindow(full)!;
		const { container } = render(TvScreen, {
			props: props(window.start + (window.end - window.start) * 0.5)
		});
		const content = text(container);
		expect(container.querySelector('[data-phase="selection"]')).not.toBeNull();
		expect(content).toContain('Alliance selection');
		expect(content).toContain('Not on an alliance yet');
		expect(content).toContain('Alliance 4 is picking.');
		expect(content).toContain('Available teams');
		expect(container.querySelectorAll('.alliances li')).toHaveLength(4);
	});

	it('shows our alliance and next playoff match', () => {
		const { container } = render(TvScreen, { props: props(at('M1')) });
		const content = text(container);
		expect(container.querySelector('[data-phase="playoffs"]')).not.toBeNull();
		expect(content).toContain('M3');
		expect(content).toContain('Upper bracket round 2');
		expect(content).toContain('Alliance 5');
		expect(content).toContain('Playoff record 1-0.');
	});

	it('wraps up with the final rank and awards', () => {
		const { container } = render(TvScreen, { props: props(at('M10') + 20 * 60_000) });
		const content = text(container);
		expect(container.querySelector('[data-phase="done"]')).not.toBeNull();
		expect(content).toContain('Final rank');
		expect(content).toContain('6th of 27');
		expect(content).toContain('5-0-0 with an RS of 3.60');
		expect(content).toContain('Out after M5');
		expect(content).toContain('Inspire Award');
		expect(content).toContain('Final rankings');
	});

	it('does not promise alliance selection or awards at a league meet', () => {
		const meet = fixtureBundle('USFLORM1');
		const quals = meet.matches.filter((item) => item.level === 'qual');
		const team = meet.rankings.find((row) => {
			const ours = quals.filter((item) => sideOf(item, row.team) !== null);
			return ours.length > 0 && ours.at(-1)!.key !== quals.at(-1)!.key;
		})!.team;
		const last = quals.filter((item) => sideOf(item, team) !== null).at(-1)!;
		const time = replayStart(last.label, meet)!;
		const during = pitView({ bundle: replayBundle(meet, time), analysis: null, queue: null, team });
		const { container } = render(TvScreen, {
			props: { ...props(time), view: during, event: meet.event }
		});
		expect(text(container)).toContain('Our qualification matches are done.');
		expect(text(container)).not.toContain('Alliance selection');
		cleanup();
		const done = pitView({ bundle: meet, analysis: null, queue: null, team });
		const after = render(TvScreen, { props: { ...props(time), view: done, event: meet.event } });
		expect(done.phase).toBe('done');
		expect(text(after.container)).toContain("League meets don't give awards.");
		expect(text(after.container)).not.toContain("Awards haven't been posted yet.");
	});

	it('says when the team is not at the event', () => {
		const bundle = replayBundle(full, at('Q22'));
		const view = pitView({ bundle, analysis: null, queue: null, team: 99999 });
		const { container } = render(TvScreen, { props: { ...props(at('Q22')), view } });
		expect(text(container)).toContain('99999 is not on the team list for this event.');
	});
});

describe('PhoneScreen', () => {
	const phone = (permission: 'default' | 'granted') => {
		const base = props(at('Q22'));
		return render(PhoneScreen, {
			props: {
				...base,
				matches: replayBundle(full, at('Q22')).matches,
				alerts: DEFAULT_ALERTS,
				permission
			}
		});
	};

	it('shows the next match and standing', () => {
		const { container } = phone('default');
		const content = text(container);
		expect(content).toContain('Next match');
		expect(content).toContain('Scheduled for 1:58 PM');
		expect(content).toContain('3 matches from now. Field is 2 min behind.');
		const facts = [...container.querySelectorAll('dl.kv dt, dl.kv dd')].map(
			(item) => item.textContent
		);
		expect(facts).toEqual(['Rank', '8 of 27', 'Record', '3-0-0', 'Ranking score', '3.33']);
		expect(screen.getByRole('link', { name: 'Event' })).toHaveAttribute('href', '/events/USAZGIQ');
		expect(screen.getByRole('link', { name: 'Tools' })).toHaveAttribute('href', '/w');
	});

	it('gives screen readers a heading, a quiet status line and labelled views', async () => {
		phone('default');
		expect(screen.getByRole('heading', { level: 1, name: String(TEAM) })).toBeInTheDocument();
		expect(screen.getByRole('status')).toHaveTextContent(/Next match Q26, Red alliance\.$/);
		const team = screen.getByRole('button', { name: 'Team' });
		const matches = screen.getByRole('button', { name: 'Matches' });
		expect(team).toHaveAttribute('aria-pressed', 'true');
		expect(matches).toHaveAttribute('aria-pressed', 'false');
		await fireEvent.click(matches);
		expect(matches).toHaveAttribute('aria-pressed', 'true');
		const ours = screen.getByRole('link', { name: 'Q26' }).closest('li')!;
		expect(ours.querySelector('.side.red')).toHaveTextContent(/^Red/);
		expect(ours.querySelector('.side.blue')).toHaveTextContent(/^Blue/);
	});

	it('says our qualification matches are done while others still play', () => {
		const time = at('Q31');
		const base = props(time);
		expect(base.view.phase).toBe('quals');
		expect(base.view.next).toBeNull();
		const { container } = render(PhoneScreen, {
			props: {
				...base,
				matches: replayBundle(full, time).matches,
				alerts: DEFAULT_ALERTS,
				permission: 'default' as const
			}
		});
		const content = text(container);
		expect(content).toContain('Our qualification matches are done.');
		expect(content).toContain(
			'31 of 34 qualification matches are posted. Alliance selection comes next.'
		);
		expect(content).not.toContain('Playoffs');
		expect(content).not.toContain('Waiting for the next match');
	});

	it('shows alerts as on only once notifications are allowed', () => {
		phone('default');
		expect(screen.getByRole('switch', { name: 'Two matches before ours' })).not.toBeChecked();
		expect(screen.getByText('Alerts arrive while this page is open.')).toBeInTheDocument();
		cleanup();
		phone('granted');
		expect(screen.getByRole('switch', { name: 'Two matches before ours' })).toBeChecked();
		expect(screen.getByRole('switch', { name: 'Our rank changes' })).not.toBeChecked();
	});

	it('only offers the alliance selection alert at events that have one', () => {
		phone('default');
		expect(screen.getByRole('switch', { name: 'Alliance selection starts' })).toBeInTheDocument();
		cleanup();
		const recorded = fixtureBundle('USFLORM1');
		const meet = replayBundle(recorded, replayStart('Q5', recorded)!);
		const team = recorded.rankings[0].team;
		render(PhoneScreen, {
			props: {
				...props(at('Q22')),
				view: pitView({ bundle: meet, analysis: null, queue: null, team }),
				event: meet.event,
				matches: meet.matches,
				alerts: DEFAULT_ALERTS,
				permission: 'default' as const
			}
		});
		expect(screen.getByRole('switch', { name: 'Two matches before ours' })).toBeInTheDocument();
		expect(screen.queryByRole('switch', { name: 'Alliance selection starts' })).toBeNull();
	});

	it('drops alerts once the event is over', () => {
		const time = at('M10') + 20 * 60_000;
		render(PhoneScreen, {
			props: {
				...props(time),
				matches: replayBundle(full, time).matches,
				alerts: DEFAULT_ALERTS,
				permission: 'default' as const
			}
		});
		expect(screen.getByText('Final rank')).toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Alerts' })).toBeNull();
		expect(screen.queryByRole('switch')).toBeNull();
	});

	it('drops the alliance selection alert once selection has started', () => {
		const time = at('M1');
		render(PhoneScreen, {
			props: {
				...props(time),
				matches: replayBundle(full, time).matches,
				alerts: DEFAULT_ALERTS,
				permission: 'default' as const
			}
		});
		expect(screen.getByRole('switch', { name: 'Two matches before ours' })).toBeInTheDocument();
		expect(screen.queryByRole('switch', { name: 'Alliance selection starts' })).toBeNull();
	});
});
