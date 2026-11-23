<script lang="ts">
	import { untrack } from 'svelte';
	import type { EventAnalysis } from '#lib/analysis/types.ts';
	import { matchStakes } from '#lib/components/event/stakes.ts';
	import type { Match, Ranking } from '#lib/types.ts';
	import { stakeLine, type MatchBrief as Brief } from './brief.ts';
	import MatchBrief from './MatchBrief.svelte';

	interface Props {
		brief: Brief;
		stakesKey: string | null;
		matches: Match[];
		rankings: Ranking[];
		analysis: EventAnalysis | null;
		team: number;
		href: (team: number) => string;
	}

	let { brief, stakesKey, matches, rankings, analysis, team, href }: Props = $props();

	const stake = $derived.by(() => {
		if (!stakesKey) return null;
		return untrack(() => {
			const match = matches.find((entry) => entry.key === brief.key);
			if (!match || !analysis) return null;
			return stakeLine(matchStakes({ match, matches, rankings, analysis }), team);
		});
	});
</script>

<MatchBrief {brief} {stake} {href} />
