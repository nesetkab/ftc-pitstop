<script lang="ts">
	import { fixed } from '#lib/format/number.ts';
	import { ordinal } from '#lib/format/ordinal.ts';
	import { pct } from '#lib/format/pct.ts';
	import { record } from '#lib/format/record.ts';
	import { relative } from '#lib/format/relative.ts';
	import { dayTime, relativeDay, time, timeWithSeconds } from '#lib/format/time.ts';
	import type { DataSource, Event, Match } from '#lib/types.ts';
	import AllianceChip from '#lib/ui/AllianceChip.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import KeyValue, { type KeyValueItem } from '#lib/ui/KeyValue.svelte';
	import MatchList from '#lib/ui/MatchList.svelte';
	import PredictionCard from '#lib/ui/PredictionCard.svelte';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import Toggle from '#lib/ui/Toggle.svelte';
	import { ALERT_OPTIONS, type AlertKey, type AlertSettings } from './alerts.ts';
	import {
		awardName,
		colorName,
		heroText,
		matchItem,
		phoneDetail,
		playoffResult,
		qualsDoneText,
		roleText
	} from './copy.ts';
	import type { Permission } from './notify.svelte.ts';
	import type { Connection } from './poll.ts';
	import type { QueueCall } from './queue.ts';
	import { sideOf, type PitView } from './view.ts';

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
		replaySpeed = null
	}: Props = $props();

	let tab = $state<'team' | 'matches'>('team');

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
	const items = $derived(
		view.matches.map((match) => matchItem(match, next?.key ?? null, timeZone, now, href(match.key)))
	);
	const facts = $derived.by(() => {
		const ranking = view.ranking;
		const list: KeyValueItem[] = [];
		if (ranking) {
			if (view.phase !== 'done') {
				list.push({ key: 'Rank', value: `${ranking.rank} of ${view.teamCount}` });
			}
			list.push({ key: 'Record', value: record(ranking.wins, ranking.losses, ranking.ties) });
			list.push({ key: 'Ranking score', value: fixed(ranking.rs, 2) });
		}
		if (view.opr !== null) list.push({ key: 'OPR', value: fixed(view.opr, 1) });
		if (view.top8 !== null) list.push({ key: 'Chance of top 8', value: pct(view.top8) });
		return list;
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
</script>

<div class="phone">
	<header class="top">
		<b>{view.team}</b>
		<span>{event.name}</span>
	</header>

	<main class="body">
		<p class={['status', { stale }]}>
			{#if connection === 'offline'}Offline.{/if}
			{#if updated !== null}
				Updated {timeWithSeconds(updated, timeZone)} from {from}{stale
					? `, ${relative(updated, now)}`
					: ''}.
			{/if}
			{#if replaySpeed !== null}
				Replay{replaySpeed === 1 ? '' : ` at ${replaySpeed}× speed`}.
			{/if}
		</p>

		{#if tab === 'team'}
			{#if !view.registered}
				<EmptyState title="{view.team} is not on the team list for this event." />
			{:else if next && text && view.phase !== 'upcoming'}
				<section class="next">
					<span class="muted">Next match</span>
					<div class="q">
						<b>{next.label}</b>
						<AllianceChip alliance={next.alliance} />
					</div>
					<span class={['big', { urgent: text.urgent }]}>{text.headline}</span>
					<span class="muted">{phoneDetail(next, timeZone, view.delaySeconds)}</span>
					{#if next.level === 'playoff' && view.playoff?.position}
						<span class="muted">{view.playoff.position}</span>
					{/if}
				</section>
				{#if prediction}
					<PredictionCard compact red={prediction.red} blue={prediction.blue} me={view.team} />
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

			{#if facts.length > 0}
				<KeyValue items={facts} />
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
										<TeamChip {number} me={number === view.team} />
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
						<Toggle
							label={option.label}
							checked={alerts[option.key] && permission === 'granted'}
							disabled={blocked}
							onchange={(on) => onalert(option.key, on)}
						/>
					{/each}
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
									{match.result.red.total}–{match.result.blue.total}
								{:else if match.actualTime !== null}
									On field
								{:else if match.scheduledTime !== null}
									{dayTime(match.scheduledTime, now, timeZone)}
								{/if}
							</span>
							<span class="side red">
								{#each match.red as slot (slot.team)}
									<span class={{ me: slot.team === view.team }}>{slot.team}</span>
								{/each}
							</span>
							<span class="side blue">
								{#each match.blue as slot (slot.team)}
									<span class={{ me: slot.team === view.team }}>{slot.team}</span>
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
		<button
			type="button"
			aria-current={tab === 'team' ? 'page' : undefined}
			onclick={() => (tab = 'team')}>Team</button
		>
		<a href="/events/{event.code}">Event</a>
		<button
			type="button"
			aria-current={tab === 'matches' ? 'page' : undefined}
			onclick={() => (tab = 'matches')}>Matches</button
		>
		<a href="/w">Tools</a>
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

	.top {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 14px 16px;
		border-bottom: 1px solid var(--line);
		background: var(--bg);
	}

	.top b {
		font-size: 16px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.top span {
		overflow: hidden;
		font-size: 13px;
		color: var(--text-2);
		text-overflow: ellipsis;
		white-space: nowrap;
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
		padding: 8px 0;
		border-bottom: 1px solid var(--line);
		font-size: 15px;
		font-weight: 500;
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
		padding: 12px 0 14px;
		border: 0;
		background: none;
		color: var(--text-3);
		font: inherit;
		text-decoration: none;
	}

	.tabs [aria-current='page'] {
		color: var(--text);
		font-weight: 600;
	}

	@media (min-width: 600px) {
		.phone {
			border-inline: 1px solid var(--line);
		}
	}
</style>
