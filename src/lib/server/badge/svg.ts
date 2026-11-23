import type { BadgeTheme } from '#lib/badge/links.ts';
import { fitText, textWidth, type Font } from './measure.ts';

export const FONT_STACK = "'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', sans-serif";

interface Palette {
	bg: string;
	line: string;
	text: string;
	text2: string;
	text3: string;
	labelBg: string;
	labelText: string;
	valueBg: string;
}

const PALETTES: Record<BadgeTheme, Palette> = {
	light: {
		bg: '#ffffff',
		line: '#cfcfca',
		text: '#1a1a19',
		text2: '#5d5d58',
		text3: '#6b6b66',
		labelBg: '#1a1a19',
		labelText: '#ffffff',
		valueBg: '#f4f4f2'
	},
	dark: {
		bg: '#131313',
		line: '#3a3a38',
		text: '#efefec',
		text2: '#ababa5',
		text3: '#9a9a92',
		labelBg: '#3a3a38',
		labelText: '#efefec',
		valueBg: '#1c1c1c'
	}
};

const INVALID_XML = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu;
const BIDI_CONTROLS = /[‪-‮⁦-⁩]/g;

export function cleanText(value: string): string {
	return value.replace(INVALID_XML, '').replace(BIDI_CONTROLS, '').replace(/\s+/g, ' ').trim();
}

export function escapeXml(value: string): string {
	return cleanText(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function round(value: number): number {
	return Math.round(value * 10) / 10;
}

interface TextOptions extends Font {
	x: number;
	y: number;
	fill: string;
	anchor?: 'start' | 'middle' | 'end';
}

function text(value: string, options: TextOptions): string {
	const width = textWidth(value, options);
	const anchor =
		options.anchor && options.anchor !== 'start' ? ` text-anchor="${options.anchor}"` : '';
	const weight = options.bold ? ' font-weight="700"' : '';
	return `<text x="${round(options.x)}" y="${round(options.y)}" fill="${options.fill}" font-size="${options.size}"${weight}${anchor} textLength="${width}" lengthAdjust="spacingAndGlyphs">${escapeXml(value)}</text>`;
}

function document(width: number, height: number, title: string, body: string[]): string {
	const label = escapeXml(title);
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">`,
		`<title>${label}</title>`,
		`<g font-family="${FONT_STACK}">`,
		...body,
		'</g>',
		'</svg>'
	].join('');
}

export const BADGE_HEIGHT = 20;
export const BADGE_PAD = 6;
export const BADGE_LABEL_FONT: Font = { size: 11 };
export const BADGE_VALUE_FONT: Font = { size: 11, bold: true };
export const BADGE_MAX_LABEL = 180;
export const BADGE_MAX_VALUE = 240;

export interface BadgeText {
	label: string;
	value: string;
}

export interface BadgeLayout {
	label: string;
	value: string;
	labelWidth: number;
	valueWidth: number;
	width: number;
}

export function badgeLayout(badge: BadgeText): BadgeLayout {
	const label = fitText(cleanText(badge.label), BADGE_LABEL_FONT, BADGE_MAX_LABEL);
	const value = fitText(cleanText(badge.value), BADGE_VALUE_FONT, BADGE_MAX_VALUE);
	const labelWidth = Math.ceil(textWidth(label, BADGE_LABEL_FONT) + BADGE_PAD * 2);
	const valueWidth = Math.ceil(textWidth(value, BADGE_VALUE_FONT) + BADGE_PAD * 2);
	return { label, value, labelWidth, valueWidth, width: labelWidth + valueWidth };
}

export function renderBadge(badge: BadgeText, theme: BadgeTheme): string {
	const colors = PALETTES[theme];
	const layout = badgeLayout(badge);
	const { labelWidth, valueWidth, width } = layout;
	const baseline = 14;
	return document(width, BADGE_HEIGHT, `${layout.label}: ${layout.value}`, [
		`<rect x="0.5" y="0.5" width="${width - 1}" height="${BADGE_HEIGHT - 1}" rx="3" fill="${colors.valueBg}" stroke="${colors.line}"/>`,
		`<path d="M3 0h${labelWidth - 3}v${BADGE_HEIGHT}h-${labelWidth - 3}a3 3 0 0 1-3-3v-${BADGE_HEIGHT - 6}a3 3 0 0 1 3-3z" fill="${colors.labelBg}"/>`,
		text(layout.label, {
			...BADGE_LABEL_FONT,
			x: BADGE_PAD,
			y: baseline,
			fill: colors.labelText
		}),
		text(layout.value, {
			...BADGE_VALUE_FONT,
			x: labelWidth + valueWidth / 2,
			y: baseline,
			fill: colors.text,
			anchor: 'middle'
		})
	]);
}

export interface CardStat {
	label: string;
	value: string;
	suffix?: string;
}

export interface CardData {
	title: string;
	name: string;
	meta: string;
	stats: CardStat[];
	trend: number[];
}

export const CARD_WIDTH = 400;
export const CARD_HEIGHT = 120;
export const CARD_PAD = 20;
export const CARD_NUMBER_FONT: Font = { size: 18, bold: true };
export const CARD_NAME_FONT: Font = { size: 14 };
export const CARD_META_FONT: Font = { size: 11 };
export const CARD_LABEL_FONT: Font = { size: 11 };
export const CARD_VALUE_FONT: Font = { size: 18, bold: true };
export const CARD_SUFFIX_FONT: Font = { size: 11 };
const COLUMNS = [76, 104, 104, 76];
const SPARK = { x: 300, y: 17, width: 80, height: 24 };
const COLUMN_GAP = 8;

export function sparkPoints(values: number[], box = SPARK): [number, number][] {
	if (values.length < 2) return [];
	const low = Math.min(...values);
	const high = Math.max(...values);
	const span = high - low || 1;
	const step = box.width / (values.length - 1);
	return values.map((value, index) => [
		round(box.x + index * step),
		round(
			high === low
				? box.y + box.height / 2
				: box.y + box.height - ((value - low) / span) * box.height
		)
	]);
}

export interface CardColumn {
	x: number;
	width: number;
	label: string;
	value: string;
	suffix: string | null;
}

export function cardColumns(stats: CardStat[]): CardColumn[] {
	let x = CARD_PAD;
	return stats.slice(0, COLUMNS.length).map((stat, index) => {
		const width = COLUMNS[index];
		const room = width - COLUMN_GAP;
		const value = fitText(cleanText(stat.value), CARD_VALUE_FONT, room);
		const left = room - textWidth(value, CARD_VALUE_FONT) - 4;
		const suffix =
			stat.suffix && textWidth(stat.suffix, CARD_SUFFIX_FONT) <= left
				? cleanText(stat.suffix)
				: null;
		const column = {
			x,
			width,
			label: fitText(cleanText(stat.label), CARD_LABEL_FONT, room),
			value,
			suffix
		};
		x += width;
		return column;
	});
}

export function cardHeader(card: Pick<CardData, 'title' | 'name' | 'trend'>) {
	const right = card.trend.length >= 2 ? SPARK.x - 12 : CARD_WIDTH - CARD_PAD;
	const title = fitText(cleanText(card.title), CARD_NUMBER_FONT, right - CARD_PAD);
	const nameX = CARD_PAD + textWidth(title, CARD_NUMBER_FONT) + 8;
	const name =
		right - nameX > 20 ? fitText(cleanText(card.name), CARD_NAME_FONT, right - nameX) : '';
	return { title, nameX, name, right };
}

export function renderCard(card: CardData, theme: BadgeTheme): string {
	const colors = PALETTES[theme];
	const header = cardHeader(card);
	const points = sparkPoints(card.trend);
	const meta = fitText(cleanText(card.meta), CARD_META_FONT, header.right - CARD_PAD);
	const top = card.stats.length > 0 ? 36 : 60;
	const body = [
		`<rect x="0.5" y="0.5" width="${CARD_WIDTH - 1}" height="${CARD_HEIGHT - 1}" rx="8" fill="${colors.bg}" stroke="${colors.line}"/>`,
		text(header.title, { ...CARD_NUMBER_FONT, x: CARD_PAD, y: top, fill: colors.text })
	];
	if (header.name) {
		body.push(
			text(header.name, { ...CARD_NAME_FONT, x: header.nameX, y: top, fill: colors.text2 })
		);
	}
	body.push(text(meta, { ...CARD_META_FONT, x: CARD_PAD, y: top + 18, fill: colors.text3 }));
	if (points.length > 0) {
		const line = points.map(([x, y]) => `${x},${y}`).join(' ');
		const [lastX, lastY] = points[points.length - 1];
		body.push(
			`<polyline points="${line}" fill="none" stroke="${colors.text2}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`,
			`<circle cx="${lastX}" cy="${lastY}" r="2.5" fill="${colors.text}"/>`,
			text('OPR by event', {
				...CARD_META_FONT,
				x: SPARK.x + SPARK.width,
				y: 54,
				fill: colors.text3,
				anchor: 'end'
			})
		);
	}
	if (card.stats.length > 0) {
		body.push(`<path d="M${CARD_PAD} 66.5h${CARD_WIDTH - CARD_PAD * 2}" stroke="${colors.line}"/>`);
	}
	for (const column of cardColumns(card.stats)) {
		body.push(text(column.label, { ...CARD_LABEL_FONT, x: column.x, y: 84, fill: colors.text2 }));
		body.push(text(column.value, { ...CARD_VALUE_FONT, x: column.x, y: 104, fill: colors.text }));
		if (column.suffix) {
			const x = column.x + textWidth(column.value, CARD_VALUE_FONT) + 4;
			body.push(text(column.suffix, { ...CARD_SUFFIX_FONT, x, y: 104, fill: colors.text3 }));
		}
	}
	const title = [
		`${card.title} ${card.name}`.trim(),
		...card.stats.map(
			(stat) => `${stat.label} ${stat.value}${stat.suffix ? ` ${stat.suffix}` : ''}`
		)
	].join(', ');
	return document(CARD_WIDTH, CARD_HEIGHT, title, body);
}
