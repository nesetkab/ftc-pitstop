<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '#lib/ui/Button.svelte';
	import {
		DEFAULT_SHOWN,
		parseShown,
		RECORD_GROUPS,
		RECORD_PART_NOTES,
		RECORD_PARTS,
		recordQuery,
		type RecordFilters,
		type RecordPart
	} from './records.ts';

	interface Props {
		filters: RecordFilters;
		ondone: () => void;
	}

	let { filters, ondone }: Props = $props();

	const chosen = $derived(new Set<RecordPart>(filters.show ?? DEFAULT_SHOWN));
	const groups = RECORD_GROUPS.map((group) => ({
		...group,
		parts: RECORD_PARTS.filter((part) => part.group === group.key)
	}));

	function choose(next: RecordPart[]) {
		const show = parseShown(next.join(','));
		goto(`/records${recordQuery({ ...filters, show })}`, { replace: true, reset: false });
	}

	function toggle(key: RecordPart, on: boolean) {
		choose(
			RECORD_PARTS.filter((part) => (part.key === key ? on : chosen.has(part.key))).map(
				(part) => part.key
			)
		);
	}
</script>

<div class="groups">
	{#each groups as group (group.key)}
		<fieldset>
			<legend>{group.label}</legend>
			{#each group.parts as part (part.key)}
				{@const sorted = filters.part === part.key}
				{@const last = chosen.size === 1 && chosen.has(part.key)}
				<label title={RECORD_PART_NOTES[part.key]}>
					<input
						type="checkbox"
						checked={chosen.has(part.key) || sorted}
						disabled={sorted || last}
						onchange={(event) => toggle(part.key, event.currentTarget.checked)}
					/>
					{part.label}
					{#if sorted}<span class="faint">sorted</span>{/if}
				</label>
			{/each}
		</fieldset>
	{/each}
</div>
<div class="foot">
	<Button variant="secondary" disabled={filters.show === null} onclick={() => choose(DEFAULT_SHOWN)}
		>Reset</Button
	>
	<Button variant="secondary" onclick={ondone}>Done</Button>
</div>

<style>
	.groups {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px 24px;
	}

	fieldset {
		display: grid;
		gap: 2px;
		align-content: start;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend {
		margin-bottom: 6px;
		padding: 0;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--text-3);
	}

	label {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 26px;
		font-size: 14px;
		cursor: pointer;
	}

	label:has(input:disabled) {
		cursor: default;
	}

	input {
		width: 15px;
		height: 15px;
		margin: 0;
		accent-color: var(--text);
	}

	.faint {
		font-size: 12.5px;
		color: var(--text-3);
	}

	.foot {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--line);
	}

	@media (pointer: coarse) {
		label {
			min-height: 36px;
		}
	}
</style>
