const API = 'https://api.ftcscout.org/graphql';

type Field = { name: string; type: { kind: string; name: string | null; ofType: { name: string | null; kind: string } | null } };

async function fields(name: string): Promise<Field[]> {
	const res = await fetch(API, {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'user-agent': 'pitstop-backtest/1.0 (+https://ftcpitstop.com)' },
		body: JSON.stringify({
			query: `query T($name: String!) { __type(name: $name) { fields { name type { kind name ofType { name kind } } } } }`,
			variables: { name }
		})
	});
	const json = (await res.json()) as { data: { __type: { fields: Field[] } | null } };
	return json.data.__type?.fields ?? [];
}

for (const s of [2021, 2022, 2023, 2024, 2025, 2026]) {
	const name = s === 2021 ? 'MatchScores2021TradAlliance' : `MatchScores${s}Alliance`;
	const list = await fields(name);
	console.log(
		s,
		list.map((f) => `${f.name}:${f.type.kind === 'NON_NULL' ? f.type.ofType?.name : f.type.name}`).join(' ')
	);
}
