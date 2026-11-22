import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureBundle } from '#lib/components/event/test-fixtures.ts';
import { notFound } from '#lib/server/errors.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { GET } from './+server.ts';

const server = vi.hoisted(() => ({ loadEventBundle: vi.fn() }));

vi.mock('#lib/server/event.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/server/event.ts')>()),
	loadEventBundle: server.loadEventBundle
}));

const bundle = fixtureBundle('USMTBUQ-final');

function get(code = 'USMTBUQ') {
	const url = new URL(`https://www.ftcpitstop.com/events/${code}/calendar.ics`);
	return GET({ params: { code }, url } as never);
}

beforeEach(() => {
	server.loadEventBundle
		.mockReset()
		.mockResolvedValue({ ...bundle, cacheControl: CACHE_CONTROL.finished });
});

describe('event calendar endpoint', () => {
	it('serves the schedule as a calendar with the event cache headers', async () => {
		const response = await get();
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
		expect(response.headers.get('content-disposition')).toBe('inline; filename="USMTBUQ.ics"');
		expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL.finished);
		const text = await response.text();
		expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
		expect(text).toContain('UID:2026-USMTBUQ-q1@ftcpitstop.com');
		expect(text).toContain('URL:https://www.ftcpitstop.com/events/USMTBUQ/matches/q1');
	});

	it('passes a short cache through while the event is live', async () => {
		server.loadEventBundle.mockResolvedValue({ ...bundle, cacheControl: CACHE_CONTROL.live });
		expect((await get()).headers.get('cache-control')).toBe(CACHE_CONTROL.live);
	});

	it('answers unknown events with a 404', async () => {
		server.loadEventBundle.mockRejectedValue(notFound('Event not found'));
		const response = await get('USXXQ');
		expect(response.status).toBe(404);
		expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL.missing);
	});
});
