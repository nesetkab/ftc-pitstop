export type RankingRow = {
	rank: number;
	team: number;
	name: string;
	rs: number;
	wins: number;
	losses: number;
	ties: number;
	tbp: number;
	tips: number;
	opr: number;
	epa: number;
	top8: number;
	dist: number[];
};

export const rankings: RankingRow[] = [
	{
		rank: 1,
		team: 26670,
		name: 'SCA Iron Eagles',
		rs: 4.5,
		wins: 4,
		losses: 0,
		ties: 0,
		tbp: 99.5,
		tips: 3.75,
		opr: 58,
		epa: 49.6,
		top8: 1,
		dist: [
			0.964, 0.034, 0.002, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
		]
	},
	{
		rank: 2,
		team: 18421,
		name: 'Unscheduled Disassembly',
		rs: 4.25,
		wins: 4,
		losses: 0,
		ties: 0,
		tbp: 86.8,
		tips: 3.25,
		opr: 48.6,
		epa: 43.7,
		top8: 1,
		dist: [
			0.022, 0.528, 0.232, 0.113, 0.092, 0.013, 0.001, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0
		]
	},
	{
		rank: 3,
		team: 18420,
		name: 'Metal Masters',
		rs: 4,
		wins: 3,
		losses: 0,
		ties: 0,
		tbp: 94.7,
		tips: 3.67,
		opr: 64.9,
		epa: 48.9,
		top8: 1,
		dist: [
			0.013, 0.256, 0.334, 0.331, 0.059, 0.005, 0.002, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0
		]
	},
	{
		rank: 4,
		team: 21579,
		name: 'Testing is Optional',
		rs: 4,
		wins: 3,
		losses: 0,
		ties: 0,
		tbp: 66,
		tips: 1.67,
		opr: 48.1,
		epa: 36.2,
		top8: 1,
		dist: [
			0, 0.181, 0.402, 0.334, 0.062, 0.018, 0.003, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0
		]
	},
	{
		rank: 5,
		team: 15058,
		name: 'RoboJags',
		rs: 3.67,
		wins: 3,
		losses: 0,
		ties: 0,
		tbp: 51.7,
		tips: 1.33,
		opr: 12.7,
		epa: 23,
		top8: 0.905,
		dist: [
			0, 0, 0.007, 0.063, 0.28, 0.249, 0.216, 0.09, 0.028, 0.018, 0.021, 0.027, 0.001, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0
		]
	},
	{
		rank: 6,
		team: 37557,
		name: 'Grape Nerds',
		rs: 3.33,
		wins: 2,
		losses: 1,
		ties: 0,
		tbp: 90.3,
		tips: 3,
		opr: 48,
		epa: 43,
		top8: 0.999,
		dist: [
			0, 0.002, 0.022, 0.144, 0.43, 0.351, 0.046, 0.004, 0.001, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0
		]
	},
	{
		rank: 7,
		team: 14624,
		name: 'Cat-Astrophic Byte',
		rs: 3.33,
		wins: 3,
		losses: 0,
		ties: 0,
		tbp: 57,
		tips: 2,
		opr: 20.4,
		epa: 25.1,
		top8: 0.586,
		dist: [
			0, 0, 0.001, 0.007, 0.053, 0.195, 0.222, 0.108, 0.155, 0.131, 0.067, 0.05, 0.009, 0.001, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
		]
	},
	{
		rank: 8,
		team: 36980,
		name: 'The Titans',
		rs: 3,
		wins: 3,
		losses: 1,
		ties: 0,
		tbp: 75.5,
		tips: 2.75,
		opr: 39.4,
		epa: 36.4,
		top8: 0.165,
		dist: [
			0, 0, 0, 0, 0.002, 0.027, 0.085, 0.051, 0.081, 0.222, 0.307, 0.223, 0.002, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0
		]
	},
	{
		rank: 9,
		team: 15135,
		name: 'Venom',
		rs: 3,
		wins: 2,
		losses: 1,
		ties: 0,
		tbp: 56,
		tips: 1.33,
		opr: 22.8,
		epa: 27.7,
		top8: 0.508,
		dist: [
			0, 0, 0.001, 0.008, 0.022, 0.058, 0.108, 0.311, 0.18, 0.095, 0.058, 0.119, 0.034, 0.005,
			0.001, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
		]
	},
	{
		rank: 10,
		team: 35802,
		name: 'Potato Blabberers',
		rs: 3,
		wins: 3,
		losses: 0,
		ties: 0,
		tbp: 48,
		tips: 1.67,
		opr: 20.5,
		epa: 24.1,
		top8: 0.001,
		dist: [
			0, 0, 0, 0, 0, 0, 0, 0.001, 0.003, 0.007, 0.013, 0.02, 0.172, 0.259, 0.288, 0.184, 0.051,
			0.002, 0, 0, 0, 0, 0, 0, 0, 0, 0
		]
	},
	{
		rank: 11,
		team: 32043,
		name: 'FALCON ROBOTICS',
		rs: 2.67,
		wins: 2,
		losses: 1,
		ties: 0,
		tbp: 84,
		tips: 3,
		opr: 29.9,
		epa: 35,
		top8: 0.435,
		dist: [
			0, 0, 0, 0, 0.001, 0.073, 0.248, 0.113, 0.106, 0.159, 0.135, 0.152, 0.007, 0.002, 0.001,
			0.001, 0.002, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
		]
	},
	{
		rank: 12,
		team: 2844,
		name: 'Valley X Robotics',
		rs: 2.25,
		wins: 2,
		losses: 2,
		ties: 0,
		tbp: 61.2,
		tips: 2,
		opr: 48.4,
		epa: 37,
		top8: 0.019,
		dist: [
			0, 0, 0, 0, 0, 0, 0.001, 0.018, 0.096, 0.21, 0.226, 0.173, 0.151, 0.093, 0.028, 0.005, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0
		]
	},
	{
		rank: 13,
		team: 12841,
		name: '+3 Robotics',
		rs: 2.25,
		wins: 2,
		losses: 2,
		ties: 0,
		tbp: 49.2,
		tips: 1.25,
		opr: 33.3,
		epa: 27.1,
		top8: 0.001,
		dist: [
			0, 0, 0, 0, 0, 0, 0, 0.001, 0.018, 0.058, 0.094, 0.116, 0.199, 0.227, 0.175, 0.087, 0.024,
			0.001, 0, 0, 0, 0, 0, 0, 0, 0, 0
		]
	},
	{
		rank: 14,
		team: 26128,
		name: 'Wrightly Reconfigured Robots',
		rs: 2,
		wins: 1,
		losses: 2,
		ties: 0,
		tbp: 84.7,
		tips: 3,
		opr: 59.6,
		epa: 45,
		top8: 0.382,
		dist: [
			0, 0, 0, 0, 0, 0.01, 0.069, 0.303, 0.331, 0.097, 0.071, 0.078, 0.028, 0.007, 0.003, 0.001,
			0.001, 0, 0.001, 0.001, 0, 0, 0, 0, 0, 0, 0
		]
	}
];
