export interface BreakerOptions {
	threshold?: number;
	cooldownMs?: number;
	maxCooldownMs?: number;
	now?: () => number;
}

export interface Breaker {
	allow(): boolean;
	success(): void;
	failure(): void;
	isOpen(): boolean;
}

export function createBreaker(options: BreakerOptions = {}): Breaker {
	const threshold = options.threshold ?? 5;
	const cooldownMs = options.cooldownMs ?? 10_000;
	const maxCooldownMs = options.maxCooldownMs ?? 60_000;
	const now = options.now ?? Date.now;
	let failures = 0;
	let trips = 0;
	let openUntil = 0;

	function cooldown(): number {
		return Math.min(cooldownMs * 2 ** Math.max(0, trips - 1), maxCooldownMs);
	}

	return {
		allow() {
			const time = now();
			if (time < openUntil) return false;
			if (trips > 0) openUntil = time + cooldown();
			return true;
		},
		success() {
			failures = 0;
			trips = 0;
			openUntil = 0;
		},
		failure() {
			failures += 1;
			if (trips === 0 && failures < threshold) return;
			trips += 1;
			failures = 0;
			openUntil = now() + cooldown();
		},
		isOpen() {
			return now() < openUntil;
		}
	};
}
