<script lang="ts">
	import type { EventAnalysis } from '#lib/analysis/types.ts';
	import { ordinal } from '#lib/format/ordinal.ts';
	import { relative } from '#lib/format/relative.ts';
	import { dayTime, relativeDay, time } from '#lib/format/time.ts';
	import { eventStream } from '#lib/stream.ts';
	import type { DataSource, Event, Match } from '#lib/types.ts';
	import AllianceChip from '#lib/ui/AllianceChip.svelte';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import MatchList from '#lib/ui/MatchList.svelte';
	import PredictionCard from '#lib/ui/PredictionCard.svelte';
	import Score from '#lib/ui/Score.svelte';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import Toggle from '#lib/ui/Toggle.svelte';
	import { ALERT_OPTIONS, type AlertKey, type AlertSettings } from './alerts.ts';
	import type BriefPanelComponent from './BriefPanel.svelte';
	import { matchBrief } from './brief.ts';
	import {
		absentText,
		awardName,
		colorName,
		eventFacts,
		fieldLine,
		heroText,
		liveText,
		matchItem,
		phoneDetail,
		playoffResult,
		qualsDoneText,
		queueCountdown,
		resultLine,
		roleText,
		teamsLine,
		updatedClock
	} from './copy.ts';
	import Facts from './Facts.svelte';
	import type { Permission } from './notify.svelte.ts';
	import type { Connection } from './poll.ts';
	import type { QueueCall } from './queue.ts';
	import { sideOf } from '#lib/components/event/matches.ts';
	import { lastMatch, moveText, type RankMemory } from './standing.ts';
	import StreamPlayer from './StreamPlayer.svelte';
	import type { PitView } from './view.ts';

	interface Props {
		view: PitView;
		event: Event;
		matches: Match[];
		now: number;
		call: QueueCall | null;
		connection: Connection;
		updated: number | null;
		source: DataSource;
		stale: boolean;
		alerts: AlertSettings;
		permission: Permission;
		onalert?: (key: AlertKey, on: boolean) => void;
		replaySpeed?: number | null;
		analysis?: EventAnalysis | null;
		rankMemory?: RankMemory | null;
		vibrate?: boolean;
		canVibrate?: boolean;
		onvibrate?: (on: boolean) => void;
		ontest?: () => void;
	}

	let {
		view,
		event,
		matches,
		now,
		call,
		connection,
		updated,
		source,
		stale,
		alerts,
		permission,
		onalert = () => {},
		replaySpeed = null,
		analysis = null,
		rankMemory = null,
		vibrate = false,
		canVibrate = false,
		onvibrate = () => {},
		ontest = () => {}
	}: Props = $props();

	let tab = $state<'team' | 'matches'>('team');
	let briefOpen = $state(false);
	let watching = $state(false);

	const timeZone = $derived(event.timezone);
	const selectionAhead = $derived(
		view.hasPlayoffs && (view.phase === 'upcoming' || view.phase === 'quals')
	);
	const alertOptions = $derived(
		ALERT_OPTIONS.filter((option) => selectionAhead || option.key !== 'selectionStarts')
	);
	const next = $derived(view.next);
	const text = $derived(next ? heroText(next, call, now, timeZone, view.delaySeconds) : null);
	const href = (key: string) => `/events/${event.code}/matches/${key}`;
	const teamHref = (number: number) => `/events/${event.code}/teams/${number}`;
	const called = $derived(text?.urgent === true);
	const countdown = $derived(next ? queueCountdown(next, call, now) : null);
	const field = $derived(fieldLine(view));
	const brief = $derived(
		next && view.registered && view.phase !== 'done'
			? matchBrief(next, analysis?.ratings ?? [])
			: null
	);
	const stakesKey = $derived(
		briefOpen && next?.level === 'qual' && analysis && view.hasPlayoffs
			? `${next.key}:${analysis.generatedAt}:${view.qualsPlayed}`
			: null
	);
	const hasBrief = $derived(brief !== null);
	let BriefPanel = $state<typeof BriefPanelComponent>();
	let briefLoading: Promise<void> | undefined;

	function loadBrief() {
		briefLoading ??= import('./BriefPanel.svelte').then((module) => {
			BriefPanel = module.default;
		});
		return briefLoading;
	}

	$effect(() => {
		if (briefOpen) loadBrief();
	});

	$effect(() => {
		if (!hasBrief || BriefPanel) return;
		if ('requestIdleCallback' in window) {
			const handle = requestIdleCallback(loadBrief, { timeout: 4000 });
			return () => cancelIdleCallback(handle);
		}
		const timer = setTimeout(loadBrief, 2000);
		return () => clearTimeout(timer);
	});
	const last = $derived(
		view.phase === 'upcoming' || view.phase === 'done' ? null : lastMatch(view, rankMemory)
	);
	const items = $derived(
		view.matches.map((match) => matchItem(match, next?.key ?? null, timeZone, now, href(match.key)))
	);
	const facts = $derived.by(() => {
		const all = eventFacts(view);
		if (!view.ranking)
			return all.filter((fact) => ['OPR', 'OPR rank', 'Top 8 chance'].includes(fact.label));
		return view.phase === 'done' ? all.filter((fact) => fact.label !== 'Rank') : all;
	});
	const prediction = $derived.by(() => {
		const forecast = next?.forecast;
		if (!next || !forecast) return null;
		const side = (alliance: 'red' | 'blue') => ({
			teams: next[alliance].map((slot) => ({ number: slot.number })),
			win: forecast[alliance].win,
			score: forecast[alliance].score
		});
		return { red: side('red'), blue: side('blue') };
	});
	const from = $derived(source === 'ftc' ? 'FTC Events' : 'FTCScout');
	const result = $derived(playoffResult(view));
	const qualsDone = $derived(qualsDoneText(view));
	const firstDay = $derived(
		view.firstMatch && view.firstMatch.scheduled !== null
			? relativeDay(view.firstMatch.scheduled, now, timeZone)
			: null
	);
	const blocked = $derived(permission === 'denied' || permission === 'unsupported');
	const announcement = $derived(liveText(view, call));
</script>

<div class="phone">
	<div class="pinned">
		<header class="top">
			<h1>{view.team}</h1>
			<span>{event.name}</span>
			{#if view.registered}
				<button
					type="button"
					class="watch"
					aria-expanded={watching}
					onclick={() => (watching = !watching)}
				>
					{watching ? 'Hide stream' : 'Stream'}
				</button>
			{/if}
		</header>
		{#if watching && view.registered}
			<div class="player">
				<StreamPlayer code={event.code} listed={eventStream(event)} />
			</div>
		{/if}
	</div>

	<main class="body">
		<p class="visually-hidden" role="status">{announcement}</p>
		<p class={['status', { stale }]}>
			{#if connection === 'offline'}Offline.{/if}
			{#if updated !== null}
				Updated {updatedClock(updated, now, timeZone)} from {from}{stale
					? `, ${relative(updated, now)}`
					: ''}.
			{/if}
			{#if replaySpeed !== null}
				Replay{replaySpeed === 1 ? '' : ` at ${replaySpeed}× speed`}.
			{/if}
		</p>

		{#if tab === 'team'}
			{#if !view.registered}
				{@const absent = absentText(view)}
				<EmptyState title={absent.title}>{absent.detail}</EmptyState>
			{:else if next && text && view.phase !== 'upcoming'}
				<section class={['next', { called }]}>
					<span class="muted">
						Next match{next.level === 'playoff' && view.playoff?.position
							? ` · ${view.playoff.position}`
							: ''}
					</span>
					<div class="q">
						<b>{next.label}</b>
						<AllianceChip alliance={next.alliance} />
					</div>
					<span class={['big', { urgent: text.urgent }]}>
						{text.headline}
						{#if countdown}<small>{countdown}</small>{/if}
					</span>
					{#if called}
						<span class="with">
							{colorName(next.alliance)} alliance{next.partners.length > 0
								? ` with ${next.partners.join(', ')}`
								: ''}.
						</span>
					{/if}
					{#if field}
						<span class="field">{field}</span>
					{/if}
					<span class="muted">{phoneDetail(next, timeZone, view.delaySeconds, now)}</span>
				</section>
				{#if prediction}
					<PredictionCard
						compact
						red={prediction.red}
						blue={prediction.blue}
						me={view.team}
						{teamHref}
					/>
				{/if}
			{:else if view.phase === 'upcoming'}
				{#if view.firstMatch}
					<section class="next">
						<span class="muted">First match{firstDay ? ` ${firstDay}` : ''}</span>
						<div class="q">
							<b>{view.firstMatch.label}</b>
							<AllianceChip alliance={view.firstMatch.alliance} />
						</div>
						{#if view.firstMatch.scheduled !== null}
							<span class="big">Scheduled for {time(view.firstMatch.scheduled, timeZone)}</span>
						{/if}
						<span class="muted">
							{colorName(view.firstMatch.alliance)} alliance{view.firstMatch.partners.length > 0
								? ` with ${view.firstMatch.partners.join(', ')}`
								: ''}.
						</span>
					</section>
				{:else}
					<EmptyState title="The match schedule hasn't been posted yet.">
						This page fills in on its own once it is.
					</EmptyState>
				{/if}
			{:else if view.phase === 'quals'}
				<section class="next">
					<span class="muted">Next match</span>
					<span class="big">{qualsDone.headline}</span>
					<span class="muted">{qualsDone.detail}</span>
				</section>
			{:else if view.phase === 'selection'}
				<section class="next">
					<span class="muted">Alliance selection</span>
					<span class={['big', { urgent: view.role !== null }]}>{roleText(view)}</span>
					{#if view.picking !== null}
						<span class="muted">Alliance {view.picking} is picking.</span>
					{/if}
				</section>
			{:else}
				<section class="next">
					<span class="muted">{view.phase === 'done' ? 'Final rank' : 'Playoffs'}</span>
					{#if view.phase === 'done' && view.ranking}
						<div class="q">
							<b>{ordinal(view.ranking.rank)}</b><span class="muted">of {view.teamCount}</span>
						</div>
					{/if}
					{#if result}
						<span class={['big', { urgent: view.playoff?.state === 'won' }]}>{result}</span>
					{:else if view.phase !== 'done'}
						<span class="big">Waiting for the next match</span>
					{/if}
					{#if view.phase === 'done' && view.advancing && view.advancesTo}
						<span class="muted">Advancing to {view.advancesTo}.</span>
					{/if}
				</section>
			{/if}

			{#if brief}
				<section class="sec">
					<button
						type="button"
						class="brief-toggle"
						aria-expanded={briefOpen}
						aria-controls="match-brief"
						onclick={() => (briefOpen = !briefOpen)}
					>
						<span>Match brief</span>
						<span class="muted">{briefOpen ? 'Hide' : `${brief.label} partners and opponents`}</span
						>
					</button>
					<div id="match-brief" hidden={!briefOpen}>
						{#if briefOpen && BriefPanel}
							<BriefPanel
								{brief}
								{stakesKey}
								{matches}
								rankings={view.rankings}
								{analysis}
								team={view.team}
								href={teamHref}
							/>
						{/if}
					</div>
				</section>
			{/if}

			{#if last}
				{@const move = moveText(last)}
				<section class="last">
					<span class="muted">Last match</span>
					<div class="q">
						<b>{last.label}</b>
						<span class={['result', last.outcome]}>
							{resultLine(last.outcome, last.ours, last.theirs)}
						</span>
					</div>
					<span class="muted">
						{teamsLine(last.partners, last.opponents)}
						{#if move}<span class={{ moved: last.move !== 0 }}>{move}</span>{/if}
					</span>
				</section>
			{/if}

			{#if view.registered && facts.length > 0}
				<div class="facts">
					<Facts {facts} />
				</div>
			{/if}

			{#if view.phase === 'selection' && view.alliances.length > 0}
				<section class="sec">
					<h2 class="sec-title">Alliances</h2>
					<ol class="alliances">
						{#each view.alliances as alliance (alliance.seed)}
							<li class={{ mine: alliance.seed === view.alliance?.seed }}>
								<span class="seed">{alliance.seed}</span>
								<span class="chips">
									{#each [alliance.captain, ...alliance.picks] as number (number)}
										<TeamChip {number} me={number === view.team} href={teamHref(number)} />
									{/each}
								</span>
							</li>
						{/each}
					</ol>
				</section>
			{/if}

			{#if view.phase === 'done' && view.awards.length > 0}
				<section class="sec">
					<h2 class="sec-title">Our awards</h2>
					<ul class="awards">
						{#each view.awards as award (`${award.id}-${award.placement}`)}
							<li>{awardName(award.name)}</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if items.length > 0}
				<section class="sec">
					<h2 class="sec-title">Our matches</h2>
					<MatchList {items} />
				</section>
			{/if}

			{#if view.phase !== 'done'}
				<section class="sec">
					<h2 class="sec-title">Alerts</h2>
					{#each alertOptions as option (option.key)}
						<div class="alert">
							<Toggle
								label={option.label}
								checked={alerts[option.key] && permission === 'granted'}
								disabled={blocked}
								onchange={(on) => onalert(option.key, on)}
							/>
							<p class="detail">{option.detail}</p>
						</div>
					{/each}
					{#if canVibrate && permission === 'granted'}
						<Toggle
							label="Vibrate with alerts"
							checked={vibrate}
							disabled={blocked}
							onchange={(on) => onvibrate(on)}
						/>
					{/if}
					{#if permission === 'granted'}
						<div>
							<Button variant="secondary" onclick={() => ontest()}>Send a test alert</Button>
						</div>
					{/if}
					{#if permission === 'denied'}
						<p class="note">
							Notifications are blocked for this site. Allow them in your browser settings to use
							alerts.
						</p>
					{:else if permission === 'unsupported'}
						<p class="note">
							This browser can't show notifications. On iPhone, add PitStop to your home screen
							first.
						</p>
					{:else}
						<p class="note">Alerts arrive while this page is open.</p>
					{/if}
				</section>
			{/if}
		{:else}
			<section class="sec">
				<h2 class="sec-title">All matches</h2>
				<ol class="schedule">
					{#each matches as match (match.key)}
						{@const ours = sideOf(match, view.team) !== null}
						<li class={{ ours, done: match.result !== null }}>
							<a class="label" href={href(match.key)}>{match.label}</a>
							<span class="when">
								{#if match.result}
									<Score
										left={match.result.red.total}
										right={match.result.blue.total}
										winner={match.result.winner}
									/>
								{:else if match.actualTime !== null}
									On field
								{:else if match.scheduledTime !== null}
									{dayTime(match.scheduledTime, now, timeZone)}
								{/if}
							</span>
							<span class="side red">
								<span class="visually-hidden">Red</span>
								{#each match.red as slot (slot.team)}
									<a class={{ me: slot.team === view.team }} href={teamHref(slot.team)}
										>{slot.team}</a
									>
								{/each}
							</span>
							<span class="side blue">
								<span class="visually-hidden">Blue</span>
								{#each match.blue as slot (slot.team)}
									<a class={{ me: slot.team === view.team }} href={teamHref(slot.team)}
										>{slot.team}</a
									>
								{/each}
							</span>
						</li>
					{:else}
						<li class="empty">The match schedule hasn't been posted yet.</li>
					{/each}
				</ol>
			</section>
		{/if}
	</main>

	<nav class="tabs" aria-label="Sections">
		<button type="button" aria-pressed={tab === 'team'} onclick={() => (tab = 'team')}
			><Icon name="team" size={20} />Team</button
		>
		<a href="/events/{event.code}"><Icon name="event" size={20} />Event</a>
		<button type="button" aria-pressed={tab === 'matches'} onclick={() => (tab = 'matches')}
			><Icon name="list" size={20} />Matches</button
		>
		<a href="/w"><Icon name="tools" size={20} />Tools</a>
	</nav>
</div>

<style>
	.phone {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		width: 100%;
		max-width: 560px;
		min-height: 100dvh;
		margin: 0 auto;
		background: var(--bg);
	}

	.pinned {
		position: sticky;
		top: 0;
		z-index: 2;
		border-bottom: 1px solid var(--line);
		background: var(--bg);
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 14px 16px;
	}

	.player {
		padding: 0 16px 12px;
		font-size: 15px;
	}

	.top h1 {
		font-size: 16px;
		font-weight: 600;
		line-height: inherit;
		letter-spacing: normal;
		font-variant-numeric: tabular-nums;
	}

	.top span {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-align: right;
		font-size: 13px;
		color: var(--text-2);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.watch {
		flex-shrink: 0;
		min-height: 40px;
		margin-block: -8px;
		padding: 0 12px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--text);
		font: 500 14px/1 var(--font);
	}

	.watch[aria-expanded='true'] {
		color: var(--text-2);
	}

	.body {
		display: grid;
		align-content: start;
		gap: 18px;
		padding: 12px 16px 24px;
	}

	.status {
		justify-self: start;
		font-size: 13px;
		color: var(--text-3);
	}

	.status.stale {
		margin-inline: -4px;
		padding: 1px 4px;
		border-radius: var(--radius-chip);
		background: var(--surface);
		color: var(--text);
	}

	.next {
		display: grid;
		gap: 4px;
	}

	.next .muted {
		font-size: 14px;
	}

	.q {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.q b {
		font-size: 40px;
		line-height: 1;
		font-weight: 650;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}

	.big {
		font-size: 22px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.big small {
		margin-left: 6px;
		font-size: 15px;
		font-weight: 500;
		color: var(--text-2);
	}

	.next.called {
		margin-inline: -16px;
		padding: 16px;
		background: var(--accent);
		color: var(--on-accent);
	}

	.next.called .q :global(.chip) {
		background: var(--bg);
	}

	.next.called .muted,
	.next.called .field {
		color: inherit;
		opacity: 0.8;
	}

	.next.called .big {
		font-size: 34px;
		line-height: 1.1;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.next.called .big.urgent {
		margin-inline: 0;
		padding: 0;
		background: none;
		color: inherit;
	}

	.with {
		font-size: 17px;
		font-weight: 500;
	}

	.field {
		font-size: 14px;
		color: var(--text);
	}

	.brief-toggle {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		min-height: 44px;
		padding: 10px 0;
		border: 0;
		border-block: 1px solid var(--line);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: 15px;
		font-weight: 600;
		text-align: left;
	}

	.brief-toggle .muted {
		overflow: hidden;
		font-size: 13px;
		font-weight: 400;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.last {
		display: grid;
		gap: 4px;
	}

	.last .muted {
		font-size: 14px;
	}

	.last .q b {
		font-size: 28px;
	}

	.result {
		font-size: 22px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.result.loss {
		color: var(--text-2);
	}

	.moved {
		color: var(--text);
		font-weight: 500;
	}

	.facts {
		font-size: 16px;
	}

	.alert {
		display: grid;
		gap: 2px;
	}

	.detail {
		padding-right: 56px;
		font-size: 13px;
		color: var(--text-3);
	}

	.big.urgent {
		margin-inline: -6px;
		justify-self: start;
		padding: 0 6px;
		border-radius: var(--radius-chip);
		background: var(--accent);
		color: var(--on-accent);
	}

	.sec {
		display: grid;
		gap: 8px;
	}

	.note {
		margin-top: 4px;
	}

	.alliances,
	.awards,
	.schedule {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.alliances li {
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr);
		align-items: center;
		gap: 8px;
		padding: 8px 0;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
	}

	.alliances li.mine {
		margin: 0 -8px;
		padding-inline: 8px;
		background: var(--accent-wash);
	}

	.seed {
		font-weight: 600;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.awards li {
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
	}

	.schedule li {
		display: grid;
		grid-template-columns: 44px 64px minmax(0, 1fr) minmax(0, 1fr);
		align-items: baseline;
		gap: 8px;
		padding: 8px 0;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}

	.schedule li.ours {
		margin: 0 -8px;
		padding-inline: 8px;
		background: var(--accent-wash);
	}

	.schedule .label {
		font-weight: 600;
		text-decoration: none;
	}

	.schedule .when {
		color: var(--text-2);
		white-space: nowrap;
	}

	.schedule li.done .when {
		color: var(--text);
	}

	.side {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 8px;
	}

	.side.red {
		color: var(--red);
	}

	.side.blue {
		color: var(--blue);
	}

	.side a {
		color: inherit;
		text-decoration: none;
	}

	.side .me {
		font-weight: 600;
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-decoration-color: var(--accent);
		text-underline-offset: 3px;
	}

	.schedule li.empty {
		display: block;
		color: var(--text-2);
	}

	.tabs {
		position: sticky;
		bottom: 0;
		z-index: 2;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		padding-bottom: env(safe-area-inset-bottom);
		border-top: 1px solid var(--line);
		background: var(--bg);
		font-size: 12px;
		text-align: center;
	}

	.tabs a,
	.tabs button {
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: center;
		padding: 8px 0 10px;
		border: 0;
		background: none;
		color: var(--text-3);
		font: inherit;
		text-decoration: none;
	}

	.tabs [aria-pressed='true'] {
		color: var(--text);
		font-weight: 600;
	}

	@media (min-width: 600px) {
		.phone {
			border-inline: 1px solid var(--line);
		}
	}
</style>
