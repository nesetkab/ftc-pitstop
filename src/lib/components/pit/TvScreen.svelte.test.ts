import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { replayBundle, replayStart, selectionWindow } from '#lib/game/replay.ts';
import { fixtureBundle } from './fixtures.ts';
import PhoneScreen from './PhoneScreen.svelte';
import { DEFAULT_ALERTS } from './alerts.ts';
import { queueCall } from './queue.ts';
import TvScreen from './TvScreen.svelte';
import { sideOf } from '#lib/components/event/matches.ts';
import { pitView, ROW_FIT } from './view.ts';

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
		const queue = [...container.querySelectorAll('.queue dt, .queue dd')].map(
			(item) => item.textContent
		);
		expect(queue).toEqual(['Away', '3 matches', 'Field', '2 min behind']);
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
		expect(content).toContain('Playoff record 1-0');
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

describe('TvScreen rankings fit', () => {
	const EM = 20;
	const pitch = EM * ROW_FIT.min * ROW_FIT.row;
	const final = fixtureBundle('USMTBUQ-final');

	function measure(rows: number) {
		const height = vi
			.spyOn(HTMLElement.prototype, 'clientHeight', 'get')
			.mockImplementation(function (this: HTMLElement) {
				return this.classList.contains('fit') ? pitch * (rows + 1) : 0;
			});
		const style = window.getComputedStyle;
		vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) =>
			(element as HTMLElement).classList.contains('fit')
				? ({ fontSize: `${EM}px`, getPropertyValue: () => '' } as unknown as CSSStyleDeclaration)
				: style(element, pseudo)
		);
		vi.stubGlobal(
			'ResizeObserver',
			class {
				constructor(private callback: () => void) {}
				observe() {
					this.callback();
				}
				disconnect() {}
			}
		);
		return height;
	}

	function done(team: number) {
		const view = pitView({ bundle: final, analysis: null, queue: null, team });
		return { ...props(final.fetchedAt), view, event: final.event };
	}

	const ranked = (container: HTMLElement) =>
		[...container.querySelectorAll('table.rank tbody tr')].map((row) =>
			row.classList.contains('gap') ? row.textContent?.trim() : row.firstElementChild?.textContent
		);

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('shows every team when they all fit', () => {
		measure(31);
		const { container } = render(TvScreen, { props: done(final.rankings[0].team) });
		expect(container.querySelector('[data-phase="done"]')).not.toBeNull();
		expect(ranked(container)).toHaveLength(31);
		expect(ranked(container).at(-1)).toBe('31');
	});

	it('marks the teams it leaves out below the leaders', () => {
		measure(27);
		const { container } = render(TvScreen, { props: done(final.rankings[0].team) });
		const rows = ranked(container);
		expect(rows).toHaveLength(27);
		expect(rows.slice(0, 3)).toEqual(['1', '2', '3']);
		expect(rows.at(-1)).toBe('5 more');
		expect(container.querySelector('tr.me td')?.textContent).toBe('1');
	});

	it('keeps a last place team on screen with the leaders above a gap', () => {
		measure(27);
		const { container } = render(TvScreen, { props: done(final.rankings.at(-1)!.team) });
		const rows = ranked(container);
		expect(rows).toHaveLength(27);
		expect(rows[0]).toBe('1');
		expect(rows.slice(-3)).toEqual(['5 more', '30', '31']);
		expect(container.querySelector('tr.me td')?.textContent).toBe('31');
	});

	it('shows the same your-team highlight in the awards list as in the rankings', () => {
		measure(31);
		const winner = final.awards.find((award) => award.team !== null)!.team!;
		const { container } = render(TvScreen, { props: done(winner) });
		expect(container.querySelector('.awards li.mine')).not.toBeNull();
		expect(container.querySelector('table.rank tr.me')).not.toBeNull();
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
		const facts = [...container.querySelectorAll('dl.facts dt, dl.facts dd')].map((item) =>
			item.textContent?.replace(/\s+/g, ' ').trim()
		);
		expect(facts.slice(0, 6)).toEqual(['Rank', '8 of 27', 'Record', '3-0-0', 'RS', '3.33']);
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

	it('opens a match brief with links to each team report', async () => {
		phone('default');
		const toggle = screen.getByRole('button', { name: /Match brief/ });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('table', { name: /Scoring by part/ })).toBeNull();
		await fireEvent.click(toggle);
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		const table = await screen.findByRole('table', { name: 'Scoring by part for Q26' });
		const links = [...table.querySelectorAll('a')].map((link) => link.getAttribute('href'));
		expect(links).toEqual([
			`/events/USAZGIQ/teams/${TEAM}`,
			'/events/USAZGIQ/teams/25620',
			'/events/USAZGIQ/teams/32043',
			'/events/USAZGIQ/teams/22258'
		]);
	});

	it('shows our last result', () => {
		const { container } = phone('default');
		const last = container.querySelector('.last')!;
		expect(text(last as HTMLElement)).toMatch(/Last match Q\d+ (Won|Lost|Tied) \d+–\d+/);
		expect(text(last as HTMLElement)).not.toContain('Ranked');
	});

	it('makes the queue call impossible to miss', () => {
		const time = match('q25').actualTime!;
		const base = props(time);
		expect(base.call).not.toBeNull();
		const { container } = render(PhoneScreen, {
			props: {
				...base,
				matches: replayBundle(full, time).matches,
				alerts: DEFAULT_ALERTS,
				permission: 'default' as const
			}
		});
		const hero = container.querySelector('.next.called')!;
		expect(text(hero as HTMLElement)).toContain('Queue now');
		expect(text(hero as HTMLElement)).toContain('Red alliance with 25620.');
		expect(text(hero as HTMLElement)).toContain("Q25 is on the field. We're up next.");
	});

	it('describes each alert without guessing at live data', () => {
		const { container } = phone('default');
		const details = [...container.querySelectorAll('.alert .detail')].map((node) =>
			text(node as HTMLElement).trim()
		);
		expect(details[0]).toBe('Our alliance, partners and queue time.');
		expect(details[1]).toBe('Win or loss and the final score.');
	});

	it('offers vibration and a test alert only where they work', async () => {
		const ontest = vi.fn();
		const onvibrate = vi.fn();
		const base = props(at('Q22'));
		const extra = { matches: replayBundle(full, at('Q22')).matches, alerts: DEFAULT_ALERTS };
		render(PhoneScreen, {
			props: { ...base, ...extra, permission: 'default' as const, ontest, onvibrate }
		});
		expect(screen.queryByRole('switch', { name: 'Vibrate with alerts' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Send a test alert' })).toBeNull();
		cleanup();
		render(PhoneScreen, {
			props: {
				...base,
				...extra,
				permission: 'granted' as const,
				canVibrate: true,
				vibrate: true,
				ontest,
				onvibrate
			}
		});
		await fireEvent.click(screen.getByRole('switch', { name: 'Vibrate with alerts' }));
		expect(onvibrate).toHaveBeenCalledWith(false);
		await fireEvent.click(screen.getByRole('button', { name: 'Send a test alert' }));
		expect(ontest).toHaveBeenCalledOnce();
	});

	it('links every team in the schedule to its event report', async () => {
		phone('default');
		await fireEvent.click(screen.getByRole('button', { name: 'Matches' }));
		const ours = screen.getByRole('link', { name: 'Q26' }).closest('li')!;
		expect(ours.querySelector('.side.red a')).toHaveAttribute(
			'href',
			'/events/USAZGIQ/teams/25620'
		);
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
