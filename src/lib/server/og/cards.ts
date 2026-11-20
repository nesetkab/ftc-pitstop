import { logoDataUri } from '#lib/server/og/logo.ts';

export const OG_SIZE = { width: 1200, height: 630 } as const;

const PAD = { x: 72, top: 60, bottom: 56 };

const COLORS = {
	bg: '#131313',
	text: '#efefec',
	text2: '#ababa5',
	text3: '#7d7d78',
	line: '#2c2c2b',
	accent: '#ffd21a'
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

function mark(): OgNode {
	return h('div', { style: { width: 64, height: 8, background: COLORS.accent } });
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
					{ style: { display: 'flex', fontSize: 26, color: COLORS.text3, marginTop: 8 } },
					item.label
				)
			)
		)
	);
}

export function teamCard(card: TeamCard, host: string): OgNode {
	return frame(
		host,
		h(
			'div',
			{ style: { display: 'flex', flexDirection: 'column', marginTop: 44 } },
			mark(),
			h(
				'div',
				{
					style: {
						display: 'flex',
						fontSize: 112,
						fontWeight: 700,
						lineHeight: 1,
						letterSpacing: -3,
						marginTop: 24
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
			{ style: { display: 'flex', flexDirection: 'column', marginTop: 44 } },
			mark(),
			h(
				'div',
				{
					style: {
						display: 'block',
						fontSize: 62,
						fontWeight: 700,
						lineHeight: 1.1,
						letterSpacing: -1,
						marginTop: 24,
						maxHeight: 140,
						overflow: 'hidden'
					}
				},
				card.name
			),
			h('div', { style: oneLine({ fontSize: 30, color: COLORS.text2, marginTop: 18 }) }, line)
		),
		stats(card.stats)
	);
}

export function siteCard(host: string): OgNode {
	return frame(
		host,
		h(
			'div',
			{ style: { display: 'flex', flexDirection: 'column', marginTop: 'auto', marginBottom: 24 } },
			mark(),
			h(
				'div',
				{
					style: {
						display: 'block',
						fontSize: 60,
						fontWeight: 700,
						lineHeight: 1.1,
						letterSpacing: -1.2,
						marginTop: 28,
						maxWidth: 900
					}
				},
				'FTC event results, team stats and a pit display for your team’s matches.'
			)
		)
	);
}
