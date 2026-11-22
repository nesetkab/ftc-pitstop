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

export interface Place {
	city: string | null;
	state: string | null;
	country: string | null;
}

const US = new Set(['USA', 'US', 'United States', 'United States of America']);

export function isUnitedStates(country: string | null | undefined): boolean {
	return country != null && US.has(country);
}

function regionNames(country: string | null): Record<string, string> | null {
	if (isUnitedStates(country)) return US_STATES;
	if (country === 'Canada') return CA_PROVINCES;
	return null;
}

export function stateName(state: string | null, country: string | null): string | null {
	const names = regionNames(country);
	if (!state || !names) return null;
	return names[state.toUpperCase()] ?? state;
}

export function areaName(state: string | null, country: string | null): string | null {
	return regionNames(country) ? stateName(state, country) : country;
}

function names(city: string | null, part: string | null): boolean {
	if (!city || !part) return false;
	return `, ${city.toLowerCase()}`.endsWith(`, ${part.toLowerCase()}`);
}

export function placeName(place: Place, style: 'full' | 'short' = 'full'): string {
	const full = areaName(place.state, place.country);
	const area = style === 'short' && regionNames(place.country) && full ? place.state : full;
	const repeated = names(place.city, full) || names(place.city, area);
	return [place.city, repeated ? null : area].filter(Boolean).join(', ');
}

const REGIONS: Record<string, string> = {
	USARL: 'Adventist Robotics League',
	USCALA: 'California Los Angeles',
	USCALS: 'California LAUSD',
	USCANO: 'California NorCal',
	USCASD: 'California San Diego',
	USCHS: 'Chesapeake',
	USFCT: 'Four Corners',
	USMOKS: 'Missouri and Kansas',
	USNYEX: 'New York Excelsior',
	USNYLI: 'New York Long Island',
	USNYNY: 'New York City',
	USTXCE: 'Texas Central',
	USTXHO: 'Texas Houston',
	USTXNO: 'Texas North',
	USTXSO: 'Texas South',
	USTXWP: 'Texas West and Panhandle',
	ONADOD: 'Military and Diplomatic',
	CMPZ2: 'FIRST Championship',
	NL: 'Benelux',
	HK: 'Hong Kong',
	MO: 'Macau',
	TR: 'Türkiye'
};

let countryNames: Intl.DisplayNames | null | undefined;

function countryName(code: string): string | null {
	if (countryNames === undefined) {
		try {
			countryNames = new Intl.DisplayNames('en', { type: 'region', fallback: 'none' });
		} catch {
			countryNames = null;
		}
	}
	try {
		const name = countryNames?.of(code);
		return name && name !== 'Unknown Region' ? name : null;
	} catch {
		return null;
	}
}

export function knownRegion(code: string | null | undefined): string | null {
	const key = code?.trim().toUpperCase();
	if (!key) return null;
	if (REGIONS[key]) return REGIONS[key];
	if (/^US[A-Z]{2}$/.test(key)) return US_STATES[key.slice(2)] ?? null;
	if (/^CA[A-Z]{2}$/.test(key)) return CA_PROVINCES[key.slice(2)] ?? null;
	if (/^[A-Z]{2}$/.test(key)) return countryName(key);
	return null;
}

export function regionName(code: string): string;
export function regionName(code: string | null | undefined): string | null;
export function regionName(code: string | null | undefined): string | null {
	if (!code) return null;
	return knownRegion(code) ?? code;
}
