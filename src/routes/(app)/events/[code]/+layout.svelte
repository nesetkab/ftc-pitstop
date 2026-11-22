<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { setEventView } from '#lib/components/event/context.ts';
	import { eventStatus } from '#lib/components/event/dates.ts';
	import { eventMeta } from '#lib/components/event/event-meta.ts';
	import { watchFollowed } from '#lib/components/event/follow.ts';
	import { httpUrl } from '#lib/format/url.ts';
	import { hasPlayoffs } from '#lib/game/event-types.ts';
	import Button from '#lib/ui/Button.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
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
	const stream = $derived(
		[event.liveStreamUrl, ...event.webcasts].map(httpUrl).find((url) => url !== null) ?? null
	);
	const withPlayoffs = $derived(hasPlayoffs(event.type) || bundle.alliances.length > 0);
	const onMatchPage = $derived(page.route.id?.includes('/matches/') ?? false);
	const live = $derived(eventStatus(event, Date.now()) === 'live');
	const every = $derived(bundle.phase === 'done' ? DONE_REFRESH_MS : REFRESH_MS);
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
		{ href: `${base}/rankings`, label: 'Rankings' },
		{ href: `${base}/schedule`, label: 'Schedule' },
		{ href: `${base}/results`, label: 'Results' },
		...(qualsPlayed + playoffsPlayed > 0 ? [{ href: `${base}/insights`, label: 'Insights' }] : []),
		...(withPlayoffs ? [{ href: `${base}/playoffs`, label: 'Playoffs' }] : []),
		{ href: `${base}/teams`, label: 'Teams' },
		{ href: `${base}/awards`, label: 'Awards' },
		...(withPlayoffs ? [{ href: `${base}/alliance-selection`, label: 'Alliance selection' }] : [])
	]);

	const current = $derived(
		page.url.pathname === base && started ? `${base}/rankings` : page.url.pathname
	);

	let followed = $state<ReadonlySet<number>>(new Set());

	setEventView({
		get followed() {
			return followed;
		}
	});

	$effect(() => watchFollowed((teams) => (followed = new Set(teams))));

	$effect(() => {
		if (!live) return;
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

{#snippet streamLink()}
	{#if stream}
		<Button variant="secondary" href={stream} target="_blank" rel="noopener noreferrer">
			Watch the stream
		</Button>
	{/if}
{/snippet}

{#if onMatchPage}
	<p class="crumb"><a href={base}>{event.name}</a></p>
{:else}
	<PageHeader
		title={event.name}
		meta={eventMeta(event, scheduled ? null : bundle.teams.length)}
		status={scheduled || started ? statusLine : undefined}
		actions={stream ? streamLink : undefined}
	/>
	{#if scheduled || started}
		<Tabs {tabs} {current} label="Event" />
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
