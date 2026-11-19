<svelte:options namespace="svg" />

<script lang="ts">
	const SIDE = 440;
	const START = 20;
	const lines = Array.from({ length: 5 }, (_, index) => START + ((index + 1) * SIDE) / 6);
</script>

<g class="field">
	<rect class="floor" x={START} y={START} width={SIDE} height={SIDE} />
	{#each lines as line (line)}
		<line class="tile" x1={line} y1={START} x2={line} y2={START + SIDE} />
		<line class="tile" x1={START} y1={line} x2={START + SIDE} y2={line} />
	{/each}
	<rect class="garden-r" x="20" y="20" width="80" height="10" />
	<rect class="garden-r" x="20" y="20" width="10" height="80" />
	<rect class="garden-b" x="380" y="450" width="80" height="10" />
	<rect class="garden-b" x="450" y="380" width="10" height="80" />
	<rect class="zone" x="24" y="384" width="72" height="72" />
	<rect class="zone" x="384" y="24" width="72" height="72" />
	<rect class="wall" x={START} y={START} width={SIDE} height={SIDE} />
	<rect class="frame" x="150" y="210" width="180" height="60" />
	<rect class="hive-r" x="158" y="218" width="78" height="44" />
	<rect class="hive-b" x="244" y="218" width="78" height="44" />
	<circle class="flower" cx="240" cy="20" r="14" />
	<circle class="flower" cx="240" cy="460" r="14" />
	<circle class="flower" cx="20" cy="240" r="14" />
	<circle class="flower" cx="460" cy="240" r="14" />
	<text class="label" x="240" y="288" text-anchor="middle">Hive frame</text>
	<text class="label" x="260" y="40">Flower</text>
	<text class="label" x="36" y="116">Red garden</text>
	<text class="label" x="444" y="374" text-anchor="end">Blue garden</text>
	<text class="label" x="28" y="378">Loading zone</text>
	<text class="label" x="452" y="112" text-anchor="end">Loading zone</text>
</g>

<style>
	.floor {
		fill: var(--bg);
	}

	.tile {
		stroke: var(--line-2);
		stroke-width: 1;
	}

	.wall {
		fill: none;
		stroke: var(--text-2);
		stroke-width: 3;
	}

	.frame {
		fill: none;
		stroke: var(--text-2);
		stroke-width: 2;
	}

	.hive-r {
		fill: var(--red-wash);
		stroke: var(--red);
		stroke-width: 2;
	}

	.hive-b {
		fill: var(--blue-wash);
		stroke: var(--blue);
		stroke-width: 2;
	}

	.flower {
		fill: var(--bg);
		stroke: var(--text-2);
		stroke-width: 2;
	}

	.garden-r {
		fill: var(--red);
		opacity: 0.45;
	}

	.garden-b {
		fill: var(--blue);
		opacity: 0.45;
	}

	.zone {
		fill: none;
		stroke: var(--text-3);
		stroke-width: 2;
		stroke-dasharray: 6 4;
	}

	.label {
		fill: var(--text-3);
		font: 500 11px var(--font);
		pointer-events: none;
	}

	@container (max-width: 420px) {
		.label {
			display: none;
		}
	}
</style>
