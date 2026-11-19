export type MatchRef =
	{ level: 'qual'; number: number } | { level: 'playoff'; series: number; game?: number };

export type Bracket = 'upper' | 'lower' | 'final';

export type ParsedMatch = MatchRef & { bracket?: Bracket; round?: number };

const QUAL = /^(?:qualification|q-?)\s*(\d+)$/i;
const BRACKET = /^(upper|lower|final)\s+bracket\s+round\s+(\d+)\s+match\s+(\d+)$/i;
const PLAYOFF = /^m-?\s*(\d+)$/i;
const KEY = /^([qpm])(\d+)(?:-(\d+))?$/i;

function gameSuffix(match: MatchRef, separator: string): string {
	return match.level === 'playoff' && match.game && match.game > 1
		? `${separator}${match.game}`
		: '';
}

export function matchLabel(match: MatchRef): string {
	if (match.level === 'qual') return `Q${match.number}`;
	return `M${match.series}${gameSuffix(match, '-')}`;
}

export function matchKey(match: MatchRef): string {
	if (match.level === 'qual') return `q${match.number}`;
	return `p${match.series}${gameSuffix(match, '-')}`;
}

export function parseMatchKey(key: string): MatchRef | null {
	const found = KEY.exec(key.trim());
	if (!found) return null;
	const [, kind, first, second] = found;
	if (kind.toLowerCase() === 'q') return second ? null : { level: 'qual', number: Number(first) };
	if (second) return { level: 'playoff', series: Number(first), game: Number(second) };
	return { level: 'playoff', series: Number(first) };
}

export function parseMatchDescription(description: string): ParsedMatch | null {
	const text = description.trim().replace(/\s+/g, ' ');
	const qual = QUAL.exec(text);
	if (qual) return { level: 'qual', number: Number(qual[1]) };
	const bracket = BRACKET.exec(text);
	if (bracket) {
		return {
			level: 'playoff',
			series: Number(bracket[3]),
			bracket: bracket[1].toLowerCase() as Bracket,
			round: Number(bracket[2])
		};
	}
	const playoff = PLAYOFF.exec(text);
	if (playoff) return { level: 'playoff', series: Number(playoff[1]) };
	return null;
}

export function shortMatchLabel(description: string): string {
	const parsed = parseMatchDescription(description);
	return parsed ? matchLabel(parsed) : description;
}

export function matchTitle(match: ParsedMatch): string {
	if (match.level === 'qual') return `Qualification ${match.number}`;
	const game = gameSuffix(match, ', game ');
	if (match.bracket === 'final') return `Finals match ${match.series}${game}`;
	if (match.bracket && match.round) {
		const side = match.bracket === 'upper' ? 'Upper' : 'Lower';
		return `${side} bracket round ${match.round} match ${match.series}${game}`;
	}
	return `Playoff match ${match.series}${game}`;
}
