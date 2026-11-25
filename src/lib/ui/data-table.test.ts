import { describe, expect, it } from 'vitest';
import { nextSort, sortRows, type Column } from './data-table.ts';

interface Team {
	number: number;
	name: string;
	opr: number | null;
}

const teams: Team[] = [
	{ number: 724, name: 'RedNek Robotics', opr: 88.2 },
	{ number: 3747, name: 'Mech Warriors', opr: null },
	{ number: 19666, name: 'Alpha', opr: 120.5 },
	{ number: 22406, name: 'Beta 10', opr: 88.2 },
	{ number: 22407, name: 'Beta 9', opr: 40 }
];

const number: Column<Team> = {
	key: 'number',
	label: 'Team',
	numeric: true,
	first: 'asc',
	sort: (row) => row.number
};
const name: Column<Team> = { key: 'name', label: 'Name', sort: (row) => row.name };
const opr: Column<Team> = { key: 'opr', label: 'aOPR', numeric: true, sort: (row) => row.opr };
const columns = [number, name, opr];

describe('nextSort', () => {
	it('starts numbers high to low and words A to Z', () => {
		expect(nextSort(opr, null)).toEqual({ key: 'opr', dir: 'desc' });
		expect(nextSort(name, { key: 'opr', dir: 'desc' })).toEqual({ key: 'name', dir: 'asc' });
		expect(nextSort(number, null)).toEqual({ key: 'number', dir: 'asc' });
	});

	it('flips the column that is already sorted', () => {
		expect(nextSort(opr, { key: 'opr', dir: 'desc' })).toEqual({ key: 'opr', dir: 'asc' });
		expect(nextSort(opr, { key: 'opr', dir: 'asc' })).toEqual({ key: 'opr', dir: 'desc' });
	});
});

describe('sortRows', () => {
	it('sorts numbers both ways, keeps ties in order and puts blanks last', () => {
		const down = sortRows(teams, columns, { key: 'opr', dir: 'desc' }).map((row) => row.number);
		expect(down).toEqual([19666, 724, 22406, 22407, 3747]);
		const up = sortRows(teams, columns, { key: 'opr', dir: 'asc' }).map((row) => row.number);
		expect(up).toEqual([22407, 724, 22406, 19666, 3747]);
	});

	it('sorts words with numbers in them the way people read them', () => {
		const sorted = sortRows(teams, columns, { key: 'name', dir: 'asc' }).map((row) => row.name);
		expect(sorted).toEqual(['Alpha', 'Beta 9', 'Beta 10', 'Mech Warriors', 'RedNek Robotics']);
	});

	it('leaves the rows alone with no sort or an unknown column', () => {
		expect(sortRows(teams, columns, null)).toEqual(teams);
		expect(sortRows(teams, columns, { key: 'nope', dir: 'asc' })).toEqual(teams);
		expect(sortRows(teams, columns, null)).not.toBe(teams);
	});
});
