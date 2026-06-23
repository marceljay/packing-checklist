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
}

export const PLUGS: Record<string, PlugInfo> = {
  US: { name: 'United States', types: ['A', 'B'], voltage: 120 },
  CA: { name: 'Canada', types: ['A', 'B'], voltage: 120 },
  MX: { name: 'Mexico', types: ['A', 'B'], voltage: 127 },
  GB: { name: 'United Kingdom', types: ['G'], voltage: 230 },
  IE: { name: 'Ireland', types: ['G'], voltage: 230 },
  FR: { name: 'France', types: ['C', 'E'], voltage: 230 },
  DE: { name: 'Germany', types: ['C', 'F'], voltage: 230 },
  ES: { name: 'Spain', types: ['C', 'F'], voltage: 230 },
  PT: { name: 'Portugal', types: ['C', 'F'], voltage: 230 },
  IT: { name: 'Italy', types: ['C', 'F', 'L'], voltage: 230 },
  NL: { name: 'Netherlands', types: ['C', 'F'], voltage: 230 },
  BE: { name: 'Belgium', types: ['C', 'E'], voltage: 230 },
  CH: { name: 'Switzerland', types: ['C', 'J'], voltage: 230 },
  AT: { name: 'Austria', types: ['C', 'F'], voltage: 230 },
  SE: { name: 'Sweden', types: ['C', 'F'], voltage: 230 },
  NO: { name: 'Norway', types: ['C', 'F'], voltage: 230 },
  DK: { name: 'Denmark', types: ['C', 'E', 'F', 'K'], voltage: 230 },
  FI: { name: 'Finland', types: ['C', 'F'], voltage: 230 },
  PL: { name: 'Poland', types: ['C', 'E'], voltage: 230 },
  CZ: { name: 'Czechia', types: ['C', 'E'], voltage: 230 },
  GR: { name: 'Greece', types: ['C', 'F'], voltage: 230 },
  HU: { name: 'Hungary', types: ['C', 'F'], voltage: 230 },
  RO: { name: 'Romania', types: ['C', 'F'], voltage: 230 },
  HR: { name: 'Croatia', types: ['C', 'F'], voltage: 230 },
  IS: { name: 'Iceland', types: ['C', 'F'], voltage: 230 },
  RU: { name: 'Russia', types: ['C', 'F'], voltage: 230 },
  TR: { name: 'Turkey', types: ['C', 'F'], voltage: 230 },
  JP: { name: 'Japan', types: ['A', 'B'], voltage: 100 },
  CN: { name: 'China', types: ['A', 'C', 'I'], voltage: 220 },
  HK: { name: 'Hong Kong', types: ['G'], voltage: 220 },
  KR: { name: 'South Korea', types: ['C', 'F'], voltage: 220 },
  TW: { name: 'Taiwan', types: ['A', 'B'], voltage: 110 },
  TH: { name: 'Thailand', types: ['A', 'B', 'C', 'O'], voltage: 230 },
  VN: { name: 'Vietnam', types: ['A', 'C', 'F'], voltage: 220 },
  IN: { name: 'India', types: ['C', 'D', 'M'], voltage: 230 },
  ID: { name: 'Indonesia', types: ['C', 'F'], voltage: 230 },
  MY: { name: 'Malaysia', types: ['G'], voltage: 240 },
  SG: { name: 'Singapore', types: ['G'], voltage: 230 },
  PH: { name: 'Philippines', types: ['A', 'B', 'C'], voltage: 220 },
  AU: { name: 'Australia', types: ['I'], voltage: 230 },
  NZ: { name: 'New Zealand', types: ['I'], voltage: 230 },
  AE: { name: 'United Arab Emirates', types: ['G'], voltage: 230 },
  SA: { name: 'Saudi Arabia', types: ['A', 'B', 'G'], voltage: 230 },
  IL: { name: 'Israel', types: ['C', 'H', 'M'], voltage: 230 },
  EG: { name: 'Egypt', types: ['C', 'F'], voltage: 220 },
  ZA: { name: 'South Africa', types: ['C', 'D', 'M', 'N'], voltage: 230 },
  MA: { name: 'Morocco', types: ['C', 'E'], voltage: 220 },
  BR: { name: 'Brazil', types: ['C', 'N'], voltage: 127 },
  AR: { name: 'Argentina', types: ['C', 'I'], voltage: 220 },
  CL: { name: 'Chile', types: ['C', 'L'], voltage: 220 },
  PE: { name: 'Peru', types: ['A', 'B', 'C'], voltage: 220 },
  CO: { name: 'Colombia', types: ['A', 'B'], voltage: 110 },
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
