<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { setEventView } from '#lib/components/event/context.ts';
	import { eventStatus } from '#lib/components/event/dates.ts';
	import { eventMeta } from '#lib/components/event/event-meta.ts';
	import { eventLede } from '#lib/components/event/lede.ts';
	import { watchFollows } from '#lib/components/follow/follow.svelte.ts';
	import { regionName } from '#lib/format/places.ts';
	import { shortRange } from '#lib/format/time.ts';
	import { hasPlayoffs } from '#lib/game/event-types.ts';
	import { breadcrumbs, eventDescription, eventJsonLd, siteTitle } from '#lib/seo.ts';
	import { eventStream } from '#lib/stream.ts';
	import Button from '#lib/ui/Button.svelte';
	import CalendarMenu from '#lib/ui/CalendarMenu.svelte';
	import Hint from '#lib/ui/Hint.svelte';
	import Lede from '#lib/ui/Lede.svelte';
	import { PIT_HINT } from '#lib/ui/hints.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import Tabs from '#lib/ui/Tabs.svelte';
	import type { LayoutProps } from './$types';

	const REFRESH_MS = 30_000;
	const DONE_REFRESH_MS = 120_000;

	let { data, children }: LayoutProps = $props();

	const bundle = $derived(data.bundle);
	const event = $derived(bundle.event);
	const base = $derived(`/events/${event.code}`);
	const quals = $derived(bundle.matches.filter((match) => match.level === 'qual'));
	const playoffMatches = $derived(bundle.matches.filter((match) => match.level === 'playoff'));
	const qualsPlayed = $derived(quals.filter((match) => match.result).length);
	const playoffsPlayed = $derived(playoffMatches.filter((match) => match.result).length);
	const started = $derived(bundle.rankings.length > 0 || qualsPlayed > 0 || playoffsPlayed > 0);
	const scheduled = $derived(bundle.matches.length > 0);
	const stream = $derived(eventStream(event));
	const withPlayoffs = $derived(hasPlayoffs(event.type) || bundle.alliances.length > 0);
	const onMatchPage = $derived(page.route.id?.includes('/matches/') ?? false);
	let now = $state(Date.now());
	const status = $derived(eventStatus(event, now));
	const live = $derived(status === 'live');
	const every = $derived(bundle.phase === 'done' ? DONE_REFRESH_MS : REFRESH_MS);
	const lede = $derived(eventLede(bundle));
	const showUpdated = $derived(bundle.phase !== 'done' || bundle.stale);
	const source = $derived(bundle.source === 'ftcscout' ? ' from FTCScout' : '');

	const progress = $derived.by(() => {
		const total = quals.length;
		const playoff = playoffMatches.length === 1 ? 'playoff match' : 'playoff matches';
		if (bundle.phase === 'quals' || (bundle.phase === 'upcoming' && qualsPlayed > 0)) {
			return { lead: `${qualsPlayed} of ${total}`, text: ' qualification matches played.' };
		}
		if (bundle.phase === 'upcoming' && total > 0) {
			return { lead: null, text: `${total} qualification matches scheduled.` };
		}
		if (bundle.phase === 'selection') {
			return {
				lead: null,
				text: `All ${total} qualification matches played. Alliance selection is next.`
			};
		}
		if (bundle.phase === 'playoffs') {
			const word = playoffsPlayed === 1 ? 'playoff match' : 'playoff matches';
			return { lead: `${playoffsPlayed}`, text: ` ${word} played.` };
		}
		if (total > 0 && playoffMatches.length > 0) {
			return {
				lead: null,
				text: `${total} qualification and ${playoffMatches.length} ${playoff} played.`
			};
		}
		if (total > 0) return { lead: null, text: `${total} qualification matches played.` };
		return { lead: null, text: '' };
	});

	const tabs = $derived([
		...(live && scheduled ? [{ href: `${base}/now`, label: 'Now' }] : []),
		{ href: `${base}/rankings`, label: 'Rankings' },
		{ href: `${base}/schedule`, label: 'Schedule' },
		{ href: `${base}/results`, label: 'Results' },
		...(qualsPlayed + playoffsPlayed > 0 ? [{ href: `${base}/insights`, label: 'Insights' }] : []),
		...(withPlayoffs ? [{ href: `${base}/playoffs`, label: 'Playoffs' }] : []),
		{ href: `${base}/teams`, label: 'Teams' },
		{ href: `${base}/awards`, label: 'Awards' },
		...(withPlayoffs ? [{ href: `${base}/alliance-selection`, label: 'Alliance selection' }] : [])
	]);

	const current = $derived.by(() => {
		const path = page.url.pathname;
		if (path === base && started) return `${base}/rankings`;
		if (path.startsWith(`${base}/teams/`) || path === `${base}/scouting`) return `${base}/teams`;
		return path;
	});

	const TOPICS: Record<string, { label: string; topic: string }> = {
		now: {
			label: 'Now',
			topic: 'The match on the field, what is next, the latest results and the top 8, live.'
		},
		rankings: { label: 'Rankings', topic: 'Rankings, OPR and schedule strength.' },
		schedule: { label: 'Schedule', topic: 'Match schedule with predicted scores and win chances.' },
		results: { label: 'Results', topic: 'Match results with score breakdowns.' },
		insights: {
			label: 'Insights',
			topic: 'Highest scores and average points by part, compared with the season.'
		},
		playoffs: { label: 'Playoffs', topic: 'Playoff bracket, alliances and records.' },
		teams: { label: 'Teams', topic: 'Teams with OPR and world ranks.' },
		awards: { label: 'Awards', topic: 'Award winners.' },
		'alliance-selection': {
			label: 'Alliance selection',
			topic: 'Alliance selection, pick suggestions and playoff odds.'
		},
		scouting: {
			label: 'Scouting binder',
			topic: 'Printable scouting reports for every team, with OPR by part and ranking points.'
		}
	};

	const section = $derived(page.route.id?.split('/events/[code]/')[1] ?? '');
	const teamTopic = $derived.by(() => {
		const number = page.params.number;
		if (section !== 'teams/[number]' || !number) return null;
		const name = bundle.teams.find((team) => String(team.number) === number)?.name;
		return {
			label: name ? `${number} ${name}` : `Team ${number}`,
			topic: `Scouting report for team ${number}: OPR by part, consistency, ranking points and remaining matches.`,
			path: `teams/${number}`
		};
	});
	const seo = $derived.by(() => {
		const tab = teamTopic ?? TOPICS[section];
		const tabPath = teamTopic?.path ?? section;
		const origin = page.url.origin;
		const crumbs = [
			{ name: 'PitStop', path: '/' },
			{ name: 'Events', path: '/events' },
			{ name: event.name, path: base }
		];
		const rootTopic = started ? TOPICS.rankings.topic : 'Teams, match schedule and predictions.';
		const showsRankings = !tab || (section === 'rankings' && started);
		const year = event.end.slice(0, 4);
		const when = shortRange(event.start, event.end);
		return {
			title: tab
				? siteTitle(`${tab.label} at ${event.name}`)
				: siteTitle(`${event.name}, ${when.includes(year) ? when : `${when}, ${year}`}`),
			description: eventDescription(event, status, tab ? tab.topic : rootTopic),
			path: showsRankings ? base : `${base}/${tabPath}`,
			noindex: section === 'now',
			data: [
				eventJsonLd(origin, event),
				breadcrumbs(
					origin,
					tab ? [...crumbs, { name: tab.label, path: `${base}/${tabPath}` }] : crumbs
				)
			]
		};
	});

	let followed = $state<ReadonlySet<number>>(new Set());
	const ourTeam = $derived(
		live ? (bundle.teams.find((team) => followed.has(team.number))?.number ?? null) : null
	);

	setEventView({
		get followed() {
			return followed;
		}
	});

	$effect(() => watchFollows((teams) => (followed = new Set(teams))));

	$effect(() => {
		if (status === 'done') return;
		const timer = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(timer);
	});

	$effect(() => {
		if (!live || section === 'now') return;
		let last = Date.now();
		const refresh = () => {
			if (document.visibilityState !== 'visible' || Date.now() - last < every) return;
			last = Date.now();
			invalidate('event:live');
		};
		const timer = setInterval(refresh, 5_000);
		document.addEventListener('visibilitychange', refresh);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', refresh);
		};
	});
</script>

{#snippet statusLine()}
	{#if progress.lead}<b>{progress.lead}</b>{/if}{progress.text}
	{#if showUpdated}
		<StaleNotice updated={bundle.fetchedAt} timeZone={event.timezone} staleAfter={180} />{source}.
	{/if}
{/snippet}

{#snippet ledeLine()}
	{#if lede}<Lede lead={lede.lead} rest={lede.rest} />{/if}
{/snippet}

{#snippet headerActions()}
	<CalendarMenu
		path="{base}/calendar.ics"
		filename="{event.code}.ics"
		note="Every match at this event with estimated start times. Subscribed calendars update as the day runs."
	/>
	{#if stream}
		<Button
			variant="secondary"
			icon="video"
			href={stream}
			target="_blank"
			rel="noopener noreferrer"
		>
			Watch the stream
		</Button>
	{/if}
{/snippet}

{#if !onMatchPage}
	<Seo {...seo} />
{/if}

{#if onMatchPage}
	<p class="crumb"><a href={base}>{event.name}</a></p>
{:else}
	{#if event.region}
		<p class="crumb"><a href="/regions/{event.region}">{regionName(event.region)}</a></p>
	{/if}
	<PageHeader
		title={event.name}
		meta={eventMeta(event, scheduled ? null : bundle.teams.length)}
		lede={lede ? ledeLine : undefined}
		status={scheduled || started ? statusLine : undefined}
		actions={headerActions}
		compact={section !== ''}
	/>
	{#if scheduled || started}
		<Tabs {tabs} {current} label="Event" />
	{/if}
	{#if ourTeam}
		<Hint id={PIT_HINT}>
			Your team {ourTeam} is here. Put its <a href="/{ourTeam}/tv">pit display</a> on your pit TV
			and the
			<a href="/{ourTeam}">phone view</a> on your phone.
		</Hint>
	{/if}
{/if}

{@render children()}

<style>
	.crumb {
		margin-bottom: -10px;
		font-size: 14px;
		color: var(--text-2);
	}

	.crumb a {
		text-decoration: none;
	}

	.crumb a:hover {
		color: var(--text);
		text-decoration: underline;
	}
</style>
