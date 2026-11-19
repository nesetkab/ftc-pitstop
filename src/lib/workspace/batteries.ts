import {
	LIMITS,
	type Batteries,
	type Battery,
	type BatteryStatus
} from '#lib/workspace/schemas.ts';

export const STATUS_LABELS: Record<BatteryStatus, string> = {
	charged: 'Charged',
	'in-robot': 'In the robot',
	charging: 'Charging',
	'not-in-use': 'Not in use'
};

export function suggestNext(items: readonly Battery[]): string | null {
	const candidates = items.filter((battery) => battery.status === 'charged');
	candidates.sort(
		(a, b) =>
			(b.voltage ?? -1) - (a.voltage ?? -1) ||
			(a.restedSince ?? -Infinity) - (b.restedSince ?? -Infinity) ||
			a.name.localeCompare(b.name, 'en', { numeric: true })
	);
	return candidates[0]?.id ?? null;
}

export function nextBatteryName(items: readonly Battery[]): string {
	let highest = 0;
	for (const battery of items) {
		const found = /^B(\d+)$/i.exec(battery.name.trim());
		if (found) highest = Math.max(highest, Number(found[1]));
	}
	return `B${highest + 1}`;
}

export function addBattery(batteries: Batteries, id: string, now: number): Batteries {
	if (batteries.items.length >= LIMITS.batteries) return batteries;
	if (batteries.items.some((battery) => battery.id === id)) return batteries;
	const battery: Battery = {
		id,
		name: nextBatteryName(batteries.items),
		status: 'charged',
		voltage: null,
		used: [],
		note: '',
		restedSince: now
	};
	return { ...batteries, items: [...batteries.items, battery] };
}

function change(batteries: Batteries, id: string, apply: (battery: Battery) => Battery): Batteries {
	return {
		...batteries,
		items: batteries.items.map((battery) => (battery.id === id ? apply(battery) : battery))
	};
}

export function removeBattery(batteries: Batteries, id: string): Batteries {
	return { ...batteries, items: batteries.items.filter((battery) => battery.id !== id) };
}

export function parseUsed(text: string): string[] {
	const seen = new Set<string>();
	for (const part of text.split(/[\s,;]+/)) {
		const label = part.trim().slice(0, 12);
		if (label) seen.add(label);
	}
	return [...seen].slice(0, 60);
}

function withMatch(used: readonly string[], match: string): string[] {
	const label = match.trim().slice(0, 12);
	if (!label || used.at(-1) === label) return [...used];
	return [...used, label].slice(-60);
}

export function putInRobot(batteries: Batteries, id: string, match: string): Batteries {
	if (!batteries.items.some((battery) => battery.id === id)) return batteries;
	return {
		...batteries,
		items: batteries.items.map((battery) => {
			if (battery.id === id) {
				return {
					...battery,
					status: 'in-robot',
					used: withMatch(battery.used, match),
					restedSince: null
				};
			}
			if (battery.status === 'in-robot') {
				return { ...battery, status: 'charging', restedSince: null };
			}
			return battery;
		})
	};
}

export function markCharged(batteries: Batteries, id: string, now: number): Batteries {
	return change(batteries, id, (battery) => ({
		...battery,
		status: 'charged',
		restedSince: now
	}));
}

export function setStatus(
	batteries: Batteries,
	id: string,
	status: BatteryStatus,
	now: number
): Batteries {
	return change(batteries, id, (battery) => {
		if (battery.status === status) return battery;
		return {
			...battery,
			status,
			restedSince: status === 'charged' ? now : status === 'not-in-use' ? battery.restedSince : null
		};
	});
}

export function setName(batteries: Batteries, id: string, name: string): Batteries {
	return change(batteries, id, (battery) => ({ ...battery, name: name.slice(0, 24) }));
}

export function setVoltage(batteries: Batteries, id: string, voltage: number | null): Batteries {
	const value = voltage === null || !Number.isFinite(voltage) ? null : voltage;
	return change(batteries, id, (battery) => ({
		...battery,
		voltage: value === null ? null : Math.min(Math.max(Math.round(value * 100) / 100, 0), 30)
	}));
}

export function setUsed(batteries: Batteries, id: string, used: string[]): Batteries {
	return change(batteries, id, (battery) => ({ ...battery, used: used.slice(0, 60) }));
}

export function setNote(batteries: Batteries, id: string, note: string): Batteries {
	return change(batteries, id, (battery) => ({ ...battery, note: note.slice(0, 200) }));
}

export function restedMinutes(battery: Battery, now: number): number | null {
	if (battery.status !== 'charged' || battery.restedSince === null) return null;
	return Math.max(0, Math.floor((now - battery.restedSince) / 60_000));
}

export function restLabel(minutes: number | null): string {
	if (minutes === null) return '';
	if (minutes < 1) return 'Just charged';
	if (minutes < 60) return `Rested ${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest === 0 ? `Rested ${hours} h` : `Rested ${hours} h ${rest} min`;
}
