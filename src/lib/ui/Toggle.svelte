<script lang="ts">
	interface Props {
		label: string;
		checked?: boolean;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
	}

	let { label, checked = $bindable(false), disabled = false, onchange }: Props = $props();

	const id = $props.id();
</script>

<label class="toggle" for={id}>
	<span class="text">{label}</span>
	<input
		{id}
		type="checkbox"
		role="switch"
		bind:checked
		{disabled}
		onchange={(event) => onchange?.(event.currentTarget.checked)}
	/>
	<span class="switch" aria-hidden="true"></span>
</label>

<style>
	.toggle {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 4px 0;
		font-size: 15px;
		cursor: pointer;
	}

	input {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		opacity: 0;
		pointer-events: none;
	}

	.switch {
		position: relative;
		flex: none;
		width: 38px;
		height: 22px;
		border-radius: 11px;
		background: var(--line-2);
		transition: background-color 120ms ease;
	}

	.switch::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--bg);
		transition: transform 120ms ease;
	}

	input:checked + .switch {
		background: var(--text);
	}

	input:checked + .switch::after {
		transform: translateX(16px);
	}

	input:focus-visible + .switch {
		outline: 2px solid var(--text);
		outline-offset: 2px;
	}

	input:disabled + .switch {
		opacity: 0.45;
	}

	.toggle:has(input:disabled) {
		color: var(--text-3);
		cursor: not-allowed;
	}

	@media (pointer: coarse) {
		.toggle {
			min-height: 40px;
		}
	}
</style>
