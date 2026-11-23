import { describe, expect, it } from 'vitest';
import { badgePath, badgeSnippets, badgeStat, badgeTheme } from './links.ts';

describe('badge links', () => {
	it('builds paths for each kind and theme', () => {
		expect(badgePath(26670, 'summary')).toBe('/badge/26670.svg');
		expect(badgePath(26670, 'opr')).toBe('/badge/26670.svg?stat=opr');
		expect(badgePath(26670, 'next', 'dark')).toBe('/badge/26670.svg?stat=next&theme=dark');
		expect(badgePath(26670, 'card')).toBe('/badge/26670/card.svg');
		expect(badgePath(26670, 'card', 'dark')).toBe('/badge/26670/card.svg?theme=dark');
	});

	it('reads only known stats and themes', () => {
		expect(badgeStat('region')).toBe('region');
		expect(badgeStat('<x>')).toBeNull();
		expect(badgeStat(null)).toBeNull();
		expect(badgeTheme('dark')).toBe('dark');
		expect(badgeTheme('auto')).toBe('light');
	});

	it('writes markdown, html and plain snippets that link back to the team', () => {
		const snippets = badgeSnippets('https://www.ftcpitstop.com', 26670, 'rank', 'Team [x] "Bots"');
		expect(snippets.url).toBe('https://www.ftcpitstop.com/badge/26670.svg?stat=rank');
		expect(snippets.markdown).toBe(
			'[![Team x "Bots"](https://www.ftcpitstop.com/badge/26670.svg?stat=rank)](https://www.ftcpitstop.com/teams/26670)'
		);
		expect(snippets.html).toContain('<a href="https://www.ftcpitstop.com/teams/26670">');
		expect(snippets.html).toContain(
			'srcset="https://www.ftcpitstop.com/badge/26670.svg?stat=rank&amp;theme=dark"'
		);
		expect(snippets.html).toContain('alt="Team [x] &quot;Bots&quot;"');
	});
});
