import { describe, expect, it } from 'vitest';
import { createBreaker } from '#lib/server/breaker.ts';

function clocked(options: { threshold?: number; cooldownMs?: number; maxCooldownMs?: number }) {
	const clock = { now: 0 };
	return { clock, breaker: createBreaker({ ...options, now: () => clock.now }) };
}

describe('circuit breaker', () => {
	it('stays closed until enough failures in a row', () => {
		const { breaker } = clocked({ threshold: 3 });
		breaker.failure();
		breaker.failure();
		expect(breaker.allow()).toBe(true);
		breaker.success();
		breaker.failure();
		breaker.failure();
		expect(breaker.isOpen()).toBe(false);
		breaker.failure();
		expect(breaker.isOpen()).toBe(true);
		expect(breaker.allow()).toBe(false);
	});

	it('lets one probe through after the cooldown and reopens for longer if it fails', () => {
		const { clock, breaker } = clocked({ threshold: 1, cooldownMs: 1000, maxCooldownMs: 3000 });
		breaker.failure();
		clock.now = 999;
		expect(breaker.allow()).toBe(false);
		clock.now = 1000;
		expect(breaker.allow()).toBe(true);
		expect(breaker.allow()).toBe(false);
		breaker.failure();
		clock.now = 2999;
		expect(breaker.allow()).toBe(false);
		clock.now = 3000;
		expect(breaker.allow()).toBe(true);
		breaker.failure();
		breaker.failure();
		clock.now += 3000;
		expect(breaker.allow()).toBe(true);
	});

	it('closes again after a successful probe', () => {
		const { clock, breaker } = clocked({ threshold: 1, cooldownMs: 1000 });
		breaker.failure();
		clock.now = 1000;
		expect(breaker.allow()).toBe(true);
		breaker.success();
		expect(breaker.allow()).toBe(true);
		expect(breaker.allow()).toBe(true);
		expect(breaker.isOpen()).toBe(false);
	});
});
