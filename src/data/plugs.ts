/**
 * Plug type + mains voltage by ISO-3166 alpha-2 country code, for travel-adapter
 * guidance on international trips. Covers common travel destinations; unknown
 * countries are reported as such rather than guessed. Plug letters follow the
 * IEC "Type A–O" convention.
 */
export interface PlugInfo {
  /** Country display name. */
  name: string;
  /** Plug type letters in use (e.g. ['C', 'F']). */
  types: string[];
  /** Nominal mains voltage. */
  voltage: number;
  /** Coarse world region, for grouping adapter guidance by plug type. */
  region: string;
}

export const PLUGS: Record<string, PlugInfo> = {
  US: { name: 'United States', types: ['A', 'B'], voltage: 120, region: 'North America' },
  CA: { name: 'Canada', types: ['A', 'B'], voltage: 120, region: 'North America' },
  MX: { name: 'Mexico', types: ['A', 'B'], voltage: 127, region: 'North America' },
  GB: { name: 'United Kingdom', types: ['G'], voltage: 230, region: 'Europe' },
  IE: { name: 'Ireland', types: ['G'], voltage: 230, region: 'Europe' },
  FR: { name: 'France', types: ['C', 'E'], voltage: 230, region: 'Europe' },
  DE: { name: 'Germany', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  ES: { name: 'Spain', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  PT: { name: 'Portugal', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  IT: { name: 'Italy', types: ['C', 'F', 'L'], voltage: 230, region: 'Europe' },
  NL: { name: 'Netherlands', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  BE: { name: 'Belgium', types: ['C', 'E'], voltage: 230, region: 'Europe' },
  CH: { name: 'Switzerland', types: ['C', 'J'], voltage: 230, region: 'Europe' },
  AT: { name: 'Austria', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  SE: { name: 'Sweden', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  NO: { name: 'Norway', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  DK: { name: 'Denmark', types: ['C', 'E', 'F', 'K'], voltage: 230, region: 'Europe' },
  FI: { name: 'Finland', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  PL: { name: 'Poland', types: ['C', 'E'], voltage: 230, region: 'Europe' },
  CZ: { name: 'Czechia', types: ['C', 'E'], voltage: 230, region: 'Europe' },
  GR: { name: 'Greece', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  HU: { name: 'Hungary', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  RO: { name: 'Romania', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  HR: { name: 'Croatia', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  IS: { name: 'Iceland', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  RU: { name: 'Russia', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  TR: { name: 'Turkey', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  JP: { name: 'Japan', types: ['A', 'B'], voltage: 100, region: 'East Asia' },
  CN: { name: 'China', types: ['A', 'C', 'I'], voltage: 220, region: 'East Asia' },
  HK: { name: 'Hong Kong', types: ['G'], voltage: 220, region: 'East Asia' },
  KR: { name: 'South Korea', types: ['C', 'F'], voltage: 220, region: 'East Asia' },
  TW: { name: 'Taiwan', types: ['A', 'B'], voltage: 110, region: 'East Asia' },
  TH: { name: 'Thailand', types: ['A', 'B', 'C', 'O'], voltage: 230, region: 'Southeast Asia' },
  VN: { name: 'Vietnam', types: ['A', 'C', 'F'], voltage: 220, region: 'Southeast Asia' },
  IN: { name: 'India', types: ['C', 'D', 'M'], voltage: 230, region: 'South Asia' },
  ID: { name: 'Indonesia', types: ['C', 'F'], voltage: 230, region: 'Southeast Asia' },
  MY: { name: 'Malaysia', types: ['G'], voltage: 240, region: 'Southeast Asia' },
  SG: { name: 'Singapore', types: ['G'], voltage: 230, region: 'Southeast Asia' },
  PH: { name: 'Philippines', types: ['A', 'B', 'C'], voltage: 220, region: 'Southeast Asia' },
  AU: { name: 'Australia', types: ['I'], voltage: 230, region: 'Oceania' },
  NZ: { name: 'New Zealand', types: ['I'], voltage: 230, region: 'Oceania' },
  AE: { name: 'United Arab Emirates', types: ['G'], voltage: 230, region: 'Middle East' },
  SA: { name: 'Saudi Arabia', types: ['A', 'B', 'G'], voltage: 230, region: 'Middle East' },
  IL: { name: 'Israel', types: ['C', 'H', 'M'], voltage: 230, region: 'Middle East' },
  EG: { name: 'Egypt', types: ['C', 'F'], voltage: 220, region: 'Africa' },
  ZA: { name: 'South Africa', types: ['C', 'D', 'M', 'N'], voltage: 230, region: 'Africa' },
  MA: { name: 'Morocco', types: ['C', 'E'], voltage: 220, region: 'Africa' },
  BR: { name: 'Brazil', types: ['C', 'N'], voltage: 127, region: 'South America' },
  AR: { name: 'Argentina', types: ['C', 'I'], voltage: 220, region: 'South America' },
  CL: { name: 'Chile', types: ['C', 'L'], voltage: 220, region: 'South America' },
  PE: { name: 'Peru', types: ['A', 'B', 'C'], voltage: 220, region: 'South America' },
  CO: { name: 'Colombia', types: ['A', 'B'], voltage: 110, region: 'South America' },
  // --- Expanded coverage ---------------------------------------------------
  // Europe
  LU: { name: 'Luxembourg', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  SK: { name: 'Slovakia', types: ['C', 'E'], voltage: 230, region: 'Europe' },
  SI: { name: 'Slovenia', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  BG: { name: 'Bulgaria', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  RS: { name: 'Serbia', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  UA: { name: 'Ukraine', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  EE: { name: 'Estonia', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  LV: { name: 'Latvia', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  LT: { name: 'Lithuania', types: ['C', 'F'], voltage: 230, region: 'Europe' },
  CY: { name: 'Cyprus', types: ['G'], voltage: 230, region: 'Europe' },
  MT: { name: 'Malta', types: ['G'], voltage: 230, region: 'Europe' },
  // Americas
  CR: { name: 'Costa Rica', types: ['A', 'B'], voltage: 120, region: 'Central America & Caribbean' },
  PA: { name: 'Panama', types: ['A', 'B'], voltage: 120, region: 'Central America & Caribbean' },
  EC: { name: 'Ecuador', types: ['A', 'B'], voltage: 120, region: 'South America' },
  UY: { name: 'Uruguay', types: ['C', 'F', 'L'], voltage: 230, region: 'South America' },
  DO: { name: 'Dominican Republic', types: ['A', 'B'], voltage: 120, region: 'Central America & Caribbean' },
  GT: { name: 'Guatemala', types: ['A', 'B'], voltage: 120, region: 'Central America & Caribbean' },
  // Asia
  LK: { name: 'Sri Lanka', types: ['D', 'G', 'M'], voltage: 230, region: 'South Asia' },
  NP: { name: 'Nepal', types: ['C', 'D', 'M'], voltage: 230, region: 'South Asia' },
  PK: { name: 'Pakistan', types: ['C', 'D'], voltage: 230, region: 'South Asia' },
  BD: { name: 'Bangladesh', types: ['C', 'D', 'G'], voltage: 220, region: 'South Asia' },
  KH: { name: 'Cambodia', types: ['A', 'C', 'G'], voltage: 230, region: 'Southeast Asia' },
  KZ: { name: 'Kazakhstan', types: ['C', 'F'], voltage: 220, region: 'Central Asia' },
  // Middle East
  QA: { name: 'Qatar', types: ['D', 'G'], voltage: 240, region: 'Middle East' },
  KW: { name: 'Kuwait', types: ['C', 'G'], voltage: 240, region: 'Middle East' },
  BH: { name: 'Bahrain', types: ['G'], voltage: 230, region: 'Middle East' },
  OM: { name: 'Oman', types: ['G'], voltage: 240, region: 'Middle East' },
  JO: { name: 'Jordan', types: ['C', 'F', 'G'], voltage: 230, region: 'Middle East' },
  // Africa
  KE: { name: 'Kenya', types: ['G'], voltage: 240, region: 'Africa' },
  NG: { name: 'Nigeria', types: ['D', 'G'], voltage: 230, region: 'Africa' },
  TZ: { name: 'Tanzania', types: ['D', 'G'], voltage: 230, region: 'Africa' },
  GH: { name: 'Ghana', types: ['D', 'G'], voltage: 230, region: 'Africa' },
  TN: { name: 'Tunisia', types: ['C', 'E'], voltage: 230, region: 'Africa' },
  DZ: { name: 'Algeria', types: ['C', 'F'], voltage: 230, region: 'Africa' },
};

/** Plug/voltage info for a country code (case-insensitive), or undefined if unknown. */
export function plugInfo(code?: string): PlugInfo | undefined {
  return code ? PLUGS[code.toUpperCase()] : undefined;
}

export interface PowerSummary {
  /** Destination countries we have data for. */
  known: { code: string; info: PlugInfo }[];
  /** Country codes with no plug data. */
  unknown: string[];
  /** Union of plug type letters across known countries, sorted. */
  plugTypes: string[];
  /** Distinct mains voltages across known countries, ascending. */
  voltages: number[];
}

/** Two mains "regions": 100–127 V and 220–240 V. Devices rated for one often
 *  don't tolerate the other, so crossing this divide is the converter signal. */
function voltageRegion(v: number): 'low' | 'high' {
  return v < 160 ? 'low' : 'high';
}

/** Which socket types a given plug type physically fits, beyond its own (a plug
 *  always fits its own socket). Captures common interoperability: the round-pin
 *  Europlug (C) fits the whole CEE 7 family; E/F are mutually compatible; the US
 *  Type-A plug fits grounded Type-B sockets. Conservative — unknown plugs only
 *  fit their own socket. Used to decide whether a travel adapter is needed. */
const PLUG_FITS: Record<string, string[]> = {
  A: ['B'],
  C: ['E', 'F', 'J', 'K', 'L', 'N'],
  E: ['F'],
  F: ['E'],
};

function plugFits(plug: string, socket: string): boolean {
  return plug === socket || (PLUG_FITS[plug]?.includes(socket) ?? false);
}

export interface PowerAdvice {
  /** Resolved home country (undefined if unset or unknown). */
  home?: { code: string; info: PlugInfo };
  /** Destination plug-type letters the home plug doesn't provide. */
  adapterFor: string[];
  needsAdapter: boolean;
  /** Distinct destination voltages in a different region from home. */
  voltageMismatch: number[];
  needsConverter: boolean;
}

/**
 * Compare the traveller's home country against the trip's destination countries
 * and advise whether to bring a plug adapter (destination uses plug types the
 * home plug lacks) and/or a voltage converter (destination mains is in a
 * different 120-vs-230 region). Pure; no advice without a known home country.
 */
export function travelPowerAdvice(homeCode: string | undefined, destCodes: string[]): PowerAdvice {
  const home = plugInfo(homeCode);
  if (!home) {
    return { home: undefined, adapterFor: [], needsAdapter: false, voltageMismatch: [], needsConverter: false };
  }
  const homeCodeUp = homeCode!.toUpperCase();
  const summary = powerSummary(destCodes);
  const homeRegion = voltageRegion(home.voltage);

  // A destination socket needs an adapter only if none of the home plugs fit it.
  const adapterFor = summary.plugTypes.filter(
    (socket) => !home.types.some((plug) => plugFits(plug, socket)),
  );
  const voltageMismatch = summary.voltages.filter((v) => voltageRegion(v) !== homeRegion);

  return {
    home: { code: homeCodeUp, info: home },
    adapterFor,
    needsAdapter: adapterFor.length > 0,
    voltageMismatch,
    needsConverter: voltageMismatch.length > 0,
  };
}

/** Aggregate plug/voltage data across a set of destination country codes. */
export function powerSummary(countryCodes: string[]): PowerSummary {
  const known: { code: string; info: PlugInfo }[] = [];
  const unknown: string[] = [];
  for (const raw of countryCodes) {
    const code = raw.toUpperCase();
    const info = PLUGS[code];
    if (info) known.push({ code, info });
    else unknown.push(code);
  }
  const plugTypes = [...new Set(known.flatMap((k) => k.info.types))].sort();
  const voltages = [...new Set(known.map((k) => k.info.voltage))].sort((a, b) => a - b);
  return { known, unknown, plugTypes, voltages };
}

/** Distinct world regions across the whole dataset where a plug type is used,
 *  sorted alphabetically — the "broader region list" for an adapter's notes. */
export function regionsForPlug(type: string): string[] {
  const regions = new Set<string>();
  for (const info of Object.values(PLUGS)) {
    if (info.types.includes(type)) regions.add(info.region);
  }
  return [...regions].sort();
}

/** One plug type to pack a separate adapter for, with the context for its item. */
export interface AdapterNeed {
  /** Plug type letter, e.g. 'G'. */
  type: string;
  /** Destination countries on this trip that use this plug type (names). */
  tripCountries: string[];
  /** Distinct world regions (dataset-wide) where this plug type is common. */
  regions: string[];
}

/**
 * One {@link AdapterNeed} per plug type the traveller should pack an adapter for.
 * With a known home country these are the destination plug types the home plug
 * doesn't fit (via {@link travelPowerAdvice}); without one we can't tell what
 * they already have, so every destination plug type is returned. Each need
 * carries the trip's destination countries using it plus the broader regions
 * where it's common — the info shown on the adapter item.
 */
export function adapterNeeds(homeCode: string | undefined, destCodes: string[]): AdapterNeed[] {
  const summary = powerSummary(destCodes);
  const advice = travelPowerAdvice(homeCode, destCodes);
  const types = advice.home ? advice.adapterFor : summary.plugTypes;
  return types.map((type) => ({
    type,
    tripCountries: summary.known.filter((k) => k.info.types.includes(type)).map((k) => k.info.name),
    regions: regionsForPlug(type),
  }));
}
