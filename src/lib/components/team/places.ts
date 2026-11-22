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
	PR: 'Puerto Rico'
};

const CANADIAN_PROVINCES: Record<string, string> = {
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

export interface Place {
	city: string | null;
	state: string | null;
	country: string | null;
}

function names(country: string | null): Record<string, string> | null {
	if (country === 'USA') return US_STATES;
	if (country === 'Canada') return CANADIAN_PROVINCES;
	return null;
}

export function stateName(state: string | null, country: string | null): string | null {
	if (!state) return null;
	return names(country)?.[state.toUpperCase()] ?? state;
}

function cityNames(city: string | null, part: string): boolean {
	if (!city) return false;
	const lower = city.toLowerCase();
	const target = part.toLowerCase();
	return lower === target || lower.endsWith(`, ${target}`);
}

export function placeName(place: Place, style: 'full' | 'short' = 'full'): string {
	const parts: string[] = [];
	if (place.city) parts.push(place.city);
	if (names(place.country)) {
		const full = stateName(place.state, place.country);
		const state = style === 'full' ? full : place.state;
		if (state && full && !cityNames(place.city, full) && !cityNames(place.city, state)) {
			parts.push(state);
		}
	} else if (place.country && !cityNames(place.city, place.country)) {
		parts.push(place.country);
	}
	return parts.join(', ');
}
