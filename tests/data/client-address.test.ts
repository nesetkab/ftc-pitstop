import { describe, expect, it } from 'vitest';
import { clientKey } from '#lib/server/client-address.ts';

describe('clientKey', () => {
	it('keeps IPv4 addresses as they are', () => {
		expect(clientKey('203.0.113.9')).toBe('203.0.113.9');
		expect(clientKey(' 203.0.113.9 ')).toBe('203.0.113.9');
	});

	it('uses the address the nearest proxy added when there is a chain', () => {
		expect(clientKey('1.2.3.4, 203.0.113.9')).toBe('203.0.113.9');
		expect(clientKey('2001:db8::1, 198.51.100.4')).toBe('198.51.100.4');
	});

	it('groups an IPv6 network instead of a single address', () => {
		const first = clientKey('2001:db8:1:2:3:4:5:6');
		expect(first).toBe('2001:db8:1:2::/64');
		expect(clientKey('2001:DB8:1:2::1')).toBe(first);
		expect(clientKey('2001:db8:1:2:ffff:ffff:ffff:ffff')).toBe(first);
		expect(clientKey('2001:db8:1:3::1')).not.toBe(first);
		expect(clientKey('2001:db8::')).toBe('2001:db8:0:0::/64');
		expect(clientKey('::1')).toBe('0:0:0:0::/64');
		expect(clientKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
	});

	it('treats IPv4 inside IPv6 as the IPv4 address', () => {
		expect(clientKey('::ffff:203.0.113.9')).toBe('203.0.113.9');
		expect(clientKey('::ffff:cb00:7109')).toBe('203.0.113.9');
		expect(clientKey('0:0:0:0:0:ffff:203.0.113.9')).toBe('203.0.113.9');
		expect(clientKey('64:ff9b::203.0.113.9')).toBe('64:ff9b:0:0::/64');
	});

	it.each([null, undefined, '', ' ', 'unknown', 'abc', '999.1.1.1', '1.2.3', '[::1]', '1.2.3.4:80'])(
		'puts %j in the shared unknown bucket',
		(value) => {
			expect(clientKey(value)).toBe('unknown');
		}
	);

	it('never lets a made up value become part of a storage key', () => {
		for (const hostile of ['a:b', 'x\ny', '1.2.3.4\r\n', '::1; DROP', '../../etc']) {
			expect(clientKey(hostile)).toMatch(/^(unknown|[0-9a-f:.]+(::\/64)?)$/);
		}
	});
});
