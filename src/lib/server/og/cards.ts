import { logoDataUri } from '#lib/server/og/logo.ts';

export const OG_SIZE = { width: 1200, height: 630 } as const;

const PAD = { x: 72, top: 60, bottom: 56 };

const COLORS = {
	bg: '#131313',
	text: '#efefec',
	text2: '#ababa5',
	text3: '#7d7d78',
	line: '#2c2c2b',
	red: '#ff6257',
	blue: '#5e8eff'
};

type Style = Record<string, string | number>;
type Child = OgNode | string | null | false | undefined;

export interface OgNode {
	type: string;
	props: { style?: Style; src?: string; width?: number; height?: number; children?: Child[] };
}

export interface Stat {
	label: string;
	value: string;
}

export interface TeamCard {
	number: number;
	name: string;
	place: string | null;
	stats: Stat[];
}

export interface EventCard {
	name: string;
	place: string | null;
	dates: string;
	stats: Stat[];
}

export interface AllianceLine {
	color: 'red' | 'blue';
	teams: { number: number; name: string | null }[];
	score: number | null;
	won: boolean;
}

export interface MatchCard {
	title: string;
	event: string;
	alliances: [AllianceLine, AllianceLine];
	note: string;
}

export interface ListRow {
	rank: string;
	label: string;
	detail: string | null;
	value: string;
}

export interface ListCard {
	kicker: string;
	title: string;
	rows: ListRow[];
}

export interface PageCard {
	kicker: string;
	title: string;
	subtitle?: string;
	stats?: Stat[];
}

export interface CompareColumn {
	number: number;
	name: string;
	stats: Stat[];
}

function h(type: string, props: Omit<OgNode['props'], 'children'>, ...children: Child[]): OgNode {
	return { type, props: { ...props, children: children.filter((child) => child) } };
}

function oneLine(style: Style): Style {
	return {
		...style,
		display: 'block',
		whiteSpace: 'nowrap',
		overflow: 'hidden',
		textOverflow: 'ellipsis'
	};
}

function frame(host: string, ...body: Child[]): OgNode {
	return h(
		'div',
		{
			style: {
				width: OG_SIZE.width - PAD.x * 2,
				height: OG_SIZE.height - PAD.top - PAD.bottom,
				display: 'flex',
				flexDirection: 'column',
				background: COLORS.bg,
				color: COLORS.text,
				fontFamily: 'Hanken Grotesk',
				fontWeight: 500,
				paddingTop: PAD.top,
				paddingBottom: PAD.bottom,
				paddingLeft: PAD.x,
				paddingRight: PAD.x
			}
		},
		h(
			'div',
			{ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
			h('img', { src: logoDataUri(COLORS.text), width: 196, height: 39 }),
			h('div', { style: { display: 'flex', fontSize: 26, color: COLORS.text3 } }, host)
		),
		...body
	);
}

function kicker(text: string): OgNode {
	return h(
		'div',
		{ style: oneLine({ fontSize: 28, color: COLORS.text2, letterSpacing: 0.2 }) },
		text
	);
}

function stats(items: Stat[]): OgNode | null {
	if (items.length === 0) return null;
	return h(
		'div',
		{
			style: {
				display: 'flex',
				marginTop: 'auto',
				paddingTop: 28,
				borderTop: `2px solid ${COLORS.line}`
			}
		},
		...items.map((item) =>
			h(
				'div',
				{ style: { display: 'flex', flexDirection: 'column', flex: 1, paddingRight: 24 } },
				h(
					'div',
					{ style: oneLine({ fontSize: 46, fontWeight: 700, lineHeight: 1.1 }) },
					item.value
				),
				h(
					'div',
					{ style: oneLine({ fontSize: 26, color: COLORS.text3, marginTop: 8 }) },
					item.label
				)
			)
		)
	);
}

function heading(text: string, size: number, marginTop: number): OgNode {
	return h(
		'div',
		{
			style: {
				display: 'block',
				fontSize: size,
				fontWeight: 700,
				lineHeight: 1.1,
				letterSpacing: -1,
				marginTop,
				maxHeight: Math.round(size * 1.1 * 2 + 4),
				overflow: 'hidden'
			}
		},
		text
	);
}

export function teamCard(card: TeamCard, host: string): OgNode {
	return frame(
		host,
		h(
			'div',
			{ style: { display: 'flex', flexDirection: 'column', marginTop: 48 } },
			h(
				'div',
				{
					style: {
						display: 'flex',
						fontSize: 112,
						fontWeight: 700,
						lineHeight: 1,
						letterSpacing: -3
					}
				},
				String(card.number)
			),
			h(
				'div',
				{ style: oneLine({ fontSize: 54, fontWeight: 700, lineHeight: 1.15, marginTop: 10 }) },
				card.name
			),
			card.place &&
				h(
					'div',
					{ style: oneLine({ fontSize: 30, color: COLORS.text2, marginTop: 8 }) },
					card.place
				)
		),
		stats(card.stats)
	);
}

export function eventCard(card: EventCard, host: string): OgNode {
	const line = [card.place, card.dates].filter(Boolean).join(' · ');
	return frame(
		host,
		h(
			'div',
			{ style: { display: 'flex', flexDirection: 'column', marginTop: 48 } },
			heading(card.name, 62, 0),
			h('div', { style: oneLine({ fontSize: 30, color: COLORS.text2, marginTop: 18 }) }, line)
		),
		stats(card.stats)
	);
}

function allianceRow(line: AllianceLine, decided: boolean): OgNode {
	const dim = decided && !line.won;
	const numbers = line.teams.map((team) => team.number).join('  ');
	const names = line.teams
		.map((team) => team.name)
		.filter(Boolean)
		.join(' · ');
	return h(
		'div',
		{
			style: {
				display: 'flex',
				alignItems: 'center',
				paddingTop: 18,
				paddingBottom: 18,
				borderTop: `2px solid ${COLORS.line}`
			}
		},
		h('div', {
			style: { width: 10, height: 76, background: COLORS[line.color], marginRight: 28 }
		}),
		h(
			'div',
			{ style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 } },
			h(
				'div',
				{
					style: oneLine({
						fontSize: 48,
						fontWeight: 700,
						lineHeight: 1.1,
						color: dim ? COLORS.text2 : COLORS.text
					})
				},
				numbers || 'TBD'
			),
			names &&
				h('div', { style: oneLine({ fontSize: 24, color: COLORS.text3, marginTop: 6 }) }, names)
		),
		h(
			'div',
			{
				style: {
					display: 'flex',
					fontSize: 84,
					fontWeight: 700,
					lineHeight: 1,
					letterSpacing: -2,
					marginLeft: 32,
					color: line.score === null ? COLORS.text3 : dim ? COLORS.text3 : COLORS.text
				}
			},
			line.score === null ? '–' : String(line.score)
		)
	);
}

export function matchCard(card: MatchCard, host: string): OgNode {
	const decided = card.alliances.some((line) => line.won);
	return frame(
		host,
		h(
			'div',
			{ style: { display: 'flex', flexDirection: 'column', marginTop: 34 } },
			kicker(card.event),
			h(
				'div',
				{
					style: oneLine({
						fontSize: 56,
						fontWeight: 700,
						lineHeight: 1.1,
						letterSpacing: -1,
						marginTop: 6
					})
				},
				card.title
			)
		),
		h(
			'div',
			{ style: { display: 'flex', flexDirection: 'column', marginTop: 'auto' } },
			...card.alliances.map((line) => allianceRow(line, decided)),
			h(
				'div',
				{
					style: oneLine({
						fontSize: 26,
						color: COLORS.text2,
						paddingTop: 16,
						borderTop: `2px solid ${COLORS.line}`
					})
				},
				card.note
			)
		)
	);
}

export function listCard(card: ListCard, host: string): OgNode {
	return frame(
		host,
		h(
			'div',
			{ style: { display: 'flex', flexDirection: 'column', marginTop: 34 } },
			kicker(card.kicker),
			heading(card.title, 52, 6)
		),
		h(
			'div',
			{ style: { display: 'flex', flexDirection: 'column', marginTop: 'auto' } },
			...card.rows.map((row) =>
				h(
					'div',
					{
						style: {
							display: 'flex',
							alignItems: 'baseline',
							paddingTop: 14,
							paddingBottom: 14,
							borderTop: `2px solid ${COLORS.line}`
						}
					},
					h(
						'div',
						{ style: { display: 'flex', width: 64, fontSize: 30, color: COLORS.text3 } },
						row.rank
					),
					h(
						'div',
						{
							style: oneLine({
								fontSize: 36,
								fontWeight: 700,
								flexShrink: 0,
								minWidth: 140,
								maxWidth: 560
							})
						},
						row.label
					),
					h(
						'div',
						{ style: oneLine({ flex: 1, fontSize: 28, color: COLORS.text2, marginLeft: 18 }) },
						row.detail ?? ''
					),
					h(
						'div',
						{ style: { display: 'flex', fontSize: 40, fontWeight: 700, marginLeft: 24 } },
						row.value
					)
				)
			)
		)
	);
}

export function pageCard(card: PageCard, host: string): OgNode {
	const hasStats = (card.stats ?? []).length > 0;
	return frame(
		host,
		h(
			'div',
			{
				style: {
					display: 'flex',
					flexDirection: 'column',
					marginTop: hasStats ? 48 : 'auto',
					marginBottom: hasStats ? 0 : 24
				}
			},
			kicker(card.kicker),
			heading(card.title, 62, 10),
			card.subtitle &&
				h(
					'div',
					{ style: { display: 'flex', fontSize: 30, color: COLORS.text2, marginTop: 22 } },
					card.subtitle
				)
		),
		stats(card.stats ?? [])
	);
}

export function compareCard(columns: CompareColumn[], host: string): OgNode {
	const size = columns.length > 2 ? 64 : 92;
	return frame(
		host,
		h('div', { style: { display: 'flex', marginTop: 34 } }, kicker('Team comparison')),
		h(
			'div',
			{ style: { display: 'flex', marginTop: 'auto' } },
			...columns.map((column, index) =>
				h(
					'div',
					{
						style: {
							display: 'flex',
							flexDirection: 'column',
							flex: 1,
							minWidth: 0,
							paddingLeft: index === 0 ? 0 : 28,
							paddingRight: 20,
							borderLeft: index === 0 ? 'none' : `2px solid ${COLORS.line}`
						}
					},
					h(
						'div',
						{
							style: {
								display: 'flex',
								fontSize: size,
								fontWeight: 700,
								lineHeight: 1,
								letterSpacing: -2
							}
						},
						String(column.number)
					),
					h(
						'div',
						{ style: oneLine({ fontSize: 30, fontWeight: 700, marginTop: 10 }) },
						column.name
					),
					...column.stats.map((stat) =>
						h(
							'div',
							{ style: { display: 'flex', alignItems: 'baseline', marginTop: 18 } },
							h(
								'div',
								{ style: { display: 'flex', fontSize: 40, fontWeight: 700, marginRight: 12 } },
								stat.value
							),
							h('div', { style: oneLine({ fontSize: 24, color: COLORS.text3 }) }, stat.label)
						)
					)
				)
			)
		)
	);
}

export function siteCard(host: string): OgNode {
	return frame(
		host,
		h(
			'div',
			{ style: { display: 'flex', flexDirection: 'column', marginTop: 'auto', marginBottom: 24 } },
			h(
				'div',
				{
					style: {
						display: 'block',
						fontSize: 60,
						fontWeight: 700,
						lineHeight: 1.1,
						letterSpacing: -1.2,
						maxWidth: 900
					}
				},
				'FTC event results, team stats and a pit display for your team’s matches.'
			)
		)
	);
}
