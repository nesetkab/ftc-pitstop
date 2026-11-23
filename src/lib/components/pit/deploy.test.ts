import { afterEach, describe, expect, it, vi } from 'vitest';
import { reloadDue, VERSION_CHECK, watchDeploys } from './deploy.ts';

afterEach(() => vi.useRealTimers());

const call = { key: 'q12', label: 'Q12', alliance: 'red' as const, reason: 'timing' as const };

describe('pit screens after a deploy', () => {
	it('reload onto the new build only when nothing is on screen for us', () => {
		expect(reloadDue({ updated: false, replay: null, call: null })).toBe(false);
		expect(reloadDue({ updated: true, replay: null, call: null })).toBe(true);
		expect(reloadDue({ updated: true, replay: null, call })).toBe(false);
		expect(reloadDue({ updated: true, replay: { start: 0, speed: 60 }, call: null })).toBe(false);
	});

	it('check for a new build on a slow timer and stop when the page closes', () => {
		vi.useFakeTimers();
		const check = vi.fn(async () => false);
		const stop = watchDeploys(check);
		vi.advanceTimersByTime(VERSION_CHECK - 1);
		expect(check).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(check).toHaveBeenCalledTimes(1);
		stop();
		vi.advanceTimersByTime(VERSION_CHECK * 3);
		expect(check).toHaveBeenCalledTimes(1);
	});
});
