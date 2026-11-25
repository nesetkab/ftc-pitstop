<script lang="ts">
	import '#lib/components/tools/controls.css';
	import type { Snippet } from 'svelte';
	import { fixed } from '#lib/format/number.ts';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import {
		addBattery,
		markCharged,
		parseUsed,
		putInRobot,
		removeBattery,
		restedMinutes,
		restLabel,
		setName,
		setNote,
		setStatus,
		setUsed,
		setVoltage,
		STATUS_LABELS,
		suggestNext
	} from '#lib/workspace/batteries.ts';
	import { newId } from '#lib/workspace/code.ts';
	import {
		BATTERY_STATUSES,
		type Batteries,
		type Battery,
		type BatteryStatus
	} from '#lib/workspace/schemas.ts';

	interface Props {
		batteries: Batteries;
		match?: string;
		update?: (change: (batteries: Batteries) => Batteries) => void;
		share?: Snippet;
	}

	let { batteries, match = '', update, share }: Props = $props();

	let now = $state(Date.now());
	let removing = $state<string | null>(null);

	$effect(() => {
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(timer);
	});

	const suggestedId = $derived(suggestNext(batteries.items));
	const suggested = $derived(batteries.items.find((battery) => battery.id === suggestedId) ?? null);

	const detail = $derived(
		suggested
			? [
					suggested.voltage === null ? 'Voltage not logged' : `${fixed(suggested.voltage)} V`,
					restLabel(restedMinutes(suggested, now)).toLowerCase()
				]
					.filter(Boolean)
					.join(', ')
			: ''
	);

	function rest(battery: Battery): string {
		return restLabel(restedMinutes(battery, now));
	}

	function statusText(battery: Battery): string {
		return battery.id === suggestedId
			? `${STATUS_LABELS[battery.status]}, use next`
			: STATUS_LABELS[battery.status];
	}

	function add() {
		const id = newId();
		const stamp = Date.now();
		update?.((current) => addBattery(current, id, stamp));
	}

	function enterRobot(id: string) {
		update?.((current) => putInRobot(current, id, match));
	}

	function charged(id: string) {
		const stamp = Date.now();
		update?.((current) => markCharged(current, id, stamp));
	}

	function changeStatus(id: string, status: BatteryStatus) {
		const stamp = Date.now();
		update?.((current) => setStatus(current, id, status, stamp));
	}

	function changeVoltage(id: string, input: HTMLInputElement) {
		const value = input.value.trim() === '' ? null : Number(input.value);
		update?.((current) => setVoltage(current, id, value));
	}

	function remove(id: string) {
		if (removing !== id) {
			removing = id;
			setTimeout(() => {
				if (removing === id) removing = null;
			}, 4000);
			return;
		}
		removing = null;
		update?.((current) => removeBattery(current, id));
	}
</script>

<section class="log" aria-label="Battery log">
	<div class="head">
		<h3 class="sec-title">Battery log</h3>
		{#if share}{@render share()}{/if}
	</div>

	{#if suggested}
		<div class="picking">
			<b>Use next: {suggested.name}</b>
			<span>{detail}</span>
		</div>
	{:else if batteries.items.length > 0}
		<p class="note">No battery is marked charged.</p>
	{/if}

	{#if batteries.items.length === 0}
		{#if update}
			<EmptyState title="No batteries yet.">Add the batteries your team brings.</EmptyState>
		{:else}
			<EmptyState title="No batteries yet." />
		{/if}
	{:else}
		<div class="scroll">
			<table class="t sheet">
				<thead>
					<tr>
						<th class="l" scope="col">Battery</th>
						<th class="l" scope="col">Status</th>
						<th scope="col">Voltage</th>
						<th class="l" scope="col">Used in</th>
						<th class="l" scope="col">Note</th>
						{#if update}<th class="l" scope="col"><span class="visually-hidden">Actions</span></th
							>{/if}
					</tr>
				</thead>
				<tbody>
					{#each batteries.items as battery (battery.id)}
						<tr class={{ next: battery.id === suggestedId, dim: battery.status === 'not-in-use' }}>
							<td class="l name" data-label="Battery">
								{#if update}
									<input
										class="ctl-input ctl-quiet strong"
										aria-label="Battery name"
										maxlength="24"
										value={battery.name}
										oninput={(event) => {
											const value = event.currentTarget.value;
											update((current) => setName(current, battery.id, value));
										}}
									/>
								{:else}
									<b>{battery.name}</b>
								{/if}
							</td>
							<td class="l status" data-label="Status">
								{#if update}
									<select
										class="ctl-select ctl-quiet"
										aria-label="Status of {battery.name}"
										value={battery.status}
										onchange={(event) =>
											changeStatus(battery.id, event.currentTarget.value as BatteryStatus)}
									>
										{#each BATTERY_STATUSES as status (status)}
											<option value={status}>{STATUS_LABELS[status]}</option>
										{/each}
									</select>
									{#if battery.id === suggestedId || rest(battery)}
										<span class="hint">
											{battery.id === suggestedId ? 'Use next' : ''}{battery.id === suggestedId &&
											rest(battery)
												? '. '
												: ''}{rest(battery)}
										</span>
									{/if}
								{:else}
									{statusText(battery)}
								{/if}
							</td>
							<td data-label="Voltage">
								{#if update}
									<span class="voltage">
										<input
											type="number"
											step="0.1"
											min="0"
											max="30"
											inputmode="decimal"
											class="ctl-input ctl-quiet number"
											aria-label="Voltage of {battery.name}"
											placeholder="—"
											value={battery.voltage ?? ''}
											onchange={(event) => changeVoltage(battery.id, event.currentTarget)}
										/>
										<span class="unit">V</span>
									</span>
								{:else}
									{battery.voltage === null ? '' : `${fixed(battery.voltage)} V`}
								{/if}
							</td>
							<td class="l" data-label="Used in">
								{#if update}
									<input
										class="ctl-input ctl-quiet"
										aria-label="Matches {battery.name} was used in"
										placeholder="Add matches"
										value={battery.used.join(', ')}
										onchange={(event) => {
											const used = parseUsed(event.currentTarget.value);
											update((current) => setUsed(current, battery.id, used));
										}}
									/>
								{:else}
									{battery.used.join(', ')}
								{/if}
							</td>
							<td class="l wrap" data-label="Note">
								{#if update}
									<input
										class="ctl-input ctl-quiet"
										aria-label="Note for {battery.name}"
										placeholder="Add a note"
										maxlength="200"
										value={battery.note}
										oninput={(event) => {
											const value = event.currentTarget.value;
											update((current) => setNote(current, battery.id, value));
										}}
									/>
								{:else}
									{battery.note}
								{/if}
							</td>
							{#if update}
								<td class="l actions" data-label="">
									<div class="buttons">
										<button
											type="button"
											class="ctl-btn"
											disabled={battery.status === 'in-robot'}
											onclick={() => enterRobot(battery.id)}
										>
											Put in robot
										</button>
										<button
											type="button"
											class="ctl-btn"
											disabled={battery.status === 'charged'}
											onclick={() => charged(battery.id)}
										>
											Mark charged
										</button>
										<button
											type="button"
											class="ctl-btn plain"
											aria-label={removing === battery.id
												? `Confirm removing ${battery.name}`
												: `Remove ${battery.name}`}
											onclick={() => remove(battery.id)}
										>
											{removing === battery.id ? 'Confirm' : 'Remove'}
										</button>
									</div>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if update}
		<div class="foot">
			<Button icon="plus" onclick={add}>Add battery</Button>
		</div>
	{/if}
</section>

<style>
	.log {
		display: grid;
		gap: 12px;
		align-content: start;
		min-width: 0;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
	}

	.picking {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 4px 12px;
		padding: 12px 16px;
		border-radius: var(--radius-control);
		background: var(--surface);
	}

	.picking b {
		font-weight: 600;
	}

	.picking span {
		color: var(--text-2);
		font-size: 14px;
	}

	.scroll {
		overflow-x: auto;
	}

	.sheet td {
		vertical-align: top;
	}

	.sheet td.name {
		min-width: 90px;
	}

	.sheet td.status {
		min-width: 150px;
	}

	.sheet td.wrap {
		min-width: 160px;
	}

	.strong {
		font-weight: 600;
	}

	.hint {
		display: block;
		padding: 0 6px;
		color: var(--text-2);
		font-size: 12.5px;
	}

	.voltage {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 4px;
	}

	.number {
		width: 74px;
		text-align: right;
	}

	.unit {
		color: var(--text-2);
	}

	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: 4px;
	}

	.foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
	}

	table.sheet tr.next td {
		background: var(--surface);
	}

	@media (max-width: 720px) {
		table.sheet,
		table.sheet tbody {
			display: grid;
			gap: 12px;
		}

		table.sheet thead {
			display: none;
		}

		table.sheet tr {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 8px 12px;
			padding: 12px;
			border: 1px solid var(--line);
			border-radius: var(--radius-panel);
		}

		table.sheet tr.next {
			background: var(--surface);
		}

		table.sheet td,
		table.sheet tr.next td {
			display: grid;
			gap: 2px;
			align-content: start;
			min-width: 0;
			padding: 0;
			border: 0;
			background: transparent;
			text-align: left;
			white-space: normal;
		}

		table.sheet td::before {
			content: attr(data-label);
			color: var(--text-3);
			font-size: 12.5px;
		}

		table.sheet td[data-label='']::before {
			display: none;
		}

		table.sheet td.name,
		table.sheet td.wrap,
		table.sheet td.actions {
			grid-column: 1 / -1;
		}

		.buttons {
			flex-wrap: wrap;
			justify-content: flex-start;
		}

		.voltage {
			justify-content: flex-start;
		}
	}
</style>
