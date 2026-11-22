const US_STATES: Record<string, string> = {
	AL: 'Alabama',
	AK: 'Alaska',
	AZ: 'Arizona',
	AR: 'Arkansas',
	CA: 'California',
	CO: 'Colorado',
	CT: 'Connecticut',
	DE: 'Delaware',
	DC: 'District of Columbia',
	FL: 'Florida',
	GA: 'Georgia',
	HI: 'Hawaii',
	ID: 'Idaho',
	IL: 'Illinois',
	IN: 'Indiana',
	IA: 'Iowa',
	KS: 'Kansas',
	KY: 'Kentucky',
	LA: 'Louisiana',
	ME: 'Maine',
	MD: 'Maryland',
	MA: 'Massachusetts',
	MI: 'Michigan',
	MN: 'Minnesota',
	MS: 'Mississippi',
	MO: 'Missouri',
	MT: 'Montana',
	NE: 'Nebraska',
	NV: 'Nevada',
	NH: 'New Hampshire',
	NJ: 'New Jersey',
	NM: 'New Mexico',
	NY: 'New York',
	NC: 'North Carolina',
	ND: 'North Dakota',
	OH: 'Ohio',
	OK: 'Oklahoma',
	OR: 'Oregon',
	PA: 'Pennsylvania',
	RI: 'Rhode Island',
	SC: 'South Carolina',
	SD: 'South Dakota',
	TN: 'Tennessee',
	TX: 'Texas',
	UT: 'Utah',
	VT: 'Vermont',
	VA: 'Virginia',
	WA: 'Washington',
	WV: 'West Virginia',
	WI: 'Wisconsin',
	WY: 'Wyoming',
	PR: 'Puerto Rico',
	GU: 'Guam',
	VI: 'U.S. Virgin Islands',
	AS: 'American Samoa',
	MP: 'Northern Mariana Islands'
};

const CA_PROVINCES: Record<string, string> = {
	AB: 'Alberta',
	BC: 'British Columbia',
	MB: 'Manitoba',
	NB: 'New Brunswick',
	NL: 'Newfoundland and Labrador',
	NS: 'Nova Scotia',
	NT: 'Northwest Territories',
	NU: 'Nunavut',
	ON: 'Ontario',
	PE: 'Prince Edward Island',
	QC: 'Quebec',
	SK: 'Saskatchewan',
	YT: 'Yukon'
};

const US = new Set(['USA', 'US', 'United States', 'United States of America']);

export function isUnitedStates(country: string | null | undefined): boolean {
	return country != null && US.has(country);
}

export function stateName(state: string | null, country: string | null): string | null {
	if (!state) return null;
	const code = state.toUpperCase();
	if (isUnitedStates(country)) return US_STATES[code] ?? (state.length > 3 ? state : null);
	if (country === 'Canada') return CA_PROVINCES[code] ?? (state.length > 3 ? state : null);
	return null;
}

export function areaName(state: string | null, country: string | null): string | null {
	return stateName(state, country) ?? (isUnitedStates(country) ? null : country);
}

export function placeName(
	city: string | null,
	state: string | null,
	country: string | null
): string | null {
	const area = areaName(state, country);
	const repeated = Boolean(
		city && area && `, ${city.toLowerCase()}`.endsWith(`, ${area.toLowerCase()}`)
	);
	const parts = [city, repeated ? null : area].filter((part): part is string => Boolean(part));
	return parts.length > 0 ? parts.join(', ') : null;
}
