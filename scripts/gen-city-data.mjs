// Generates the bundled offline city data committed under src/data/:
//   - geo-cities.json    : top-N cities by population → offline geocoding
//                          [name, countryCode, lat, lon]
//   - climate-cities.json: monthly climate normals + coords (offline weather
//                          fallback) [name, countryCode, lat, lon, months]
//                          months[i] = [highC, lowC, rainfallMm, dryDays]
//
// Sources (both reachable from npm/GitHub):
//   - `all-the-cities` (devDependency): GeoNames cities with population + coords
//   - michaelx/climate (GitHub raw): monthly normals for ~100 destinations
//
// Run:  npm i -D all-the-cities && node scripts/gen-city-data.mjs
import { writeFileSync } from 'node:fs';
import cities from 'all-the-cities';

const TOP_N = 1000;
const CLIMATE_URL = 'https://raw.githubusercontent.com/michaelx/climate/master/climate.min.json';

const round = (n) => Math.round(n * 100) / 100;
const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// --- 1. geocoding list: the TOP_N most populous cities -----------------------
const top = [...cities].sort((a, b) => b.population - a.population).slice(0, TOP_N);
const geo = top.map((c) => [c.name, c.country, round(c.loc.coordinates[1]), round(c.loc.coordinates[0])]);

// --- 2. country name → ISO-2 code (for matching climate cities to coords) -----
const dn = new Intl.DisplayNames(['en'], { type: 'region' });
const nameToCc = new Map();
for (const cc of new Set(cities.map((c) => c.country))) {
  const nm = dn.of(cc);
  if (nm) nameToCc.set(norm(nm), cc);
}
// michaelx uses a few short/alt country (and region) names that differ from the
// Intl display names — map them to ISO-2 codes.
const COUNTRY_ALIASES = {
  usa: 'US',
  uk: 'GB',
  'united states': 'US',
  'united kingdom': 'GB',
  'south korea': 'KR',
  'north korea': 'KP',
  russia: 'RU',
  vietnam: 'VN',
  'czech republic': 'CZ',
  uae: 'AE',
  'united arab emirates': 'AE',
  turkey: 'TR',
  'hong kong': 'HK',
  hawaii: 'US',
};
const countryToCc = (name) => COUNTRY_ALIASES[norm(name)] ?? nameToCc.get(norm(name));

// Index all-the-cities by "name|cc" → highest-population match.
const byNameCc = new Map();
for (const c of cities) {
  const k = `${norm(c.name)}|${c.country}`;
  const cur = byNameCc.get(k);
  if (!cur || c.population > cur.population) byNameCc.set(k, c);
}

// michaelx city labels carry suffixes GeoNames doesn't ("Atlanta GA",
// "Quebec City", "Ubud Bali"). Try progressively looser name variants.
const nameVariants = (city) => {
  const noState = city.replace(/\s+[A-Z]{2}\.?$/, ''); // drop trailing US state abbr
  const noCity = noState.replace(/\s+City$/i, '');
  const firstToken = noState.split(/\s+/)[0];
  return [...new Set([city, noState, noCity, firstToken].map(norm))];
};

const findCoords = (city, cc) => {
  if (!cc) return null;
  for (const nm of nameVariants(city)) {
    const hit = byNameCc.get(`${nm}|${cc}`);
    if (hit) return hit;
  }
  return null;
};

// --- 3. climate list: michaelx normals + resolved coords ---------------------
const res = await fetch(CLIMATE_URL);
if (!res.ok) throw new Error(`climate fetch failed (${res.status})`);
const climate = await res.json();

const climateOut = [];
const missing = [];
for (const e of climate) {
  const cc = countryToCc(e.country);
  const match = findCoords(e.city, cc);
  if (!match) {
    missing.push(`${e.city} (${e.country})`);
    continue;
  }
  const months = e.monthlyAvg.map((m) => [m.high, m.low, m.rainfall, m.dryDays]);
  climateOut.push([
    match.name, // clean GeoNames name (drops michaelx's "Atlanta GA" suffixes)
    cc,
    round(match.loc.coordinates[1]),
    round(match.loc.coordinates[0]),
    months,
  ]);
}

writeFileSync('src/data/geo-cities.json', JSON.stringify(geo));
writeFileSync('src/data/climate-cities.json', JSON.stringify(climateOut));

console.log(`geo-cities.json:     ${geo.length} cities`);
console.log(`climate-cities.json: ${climateOut.length} cities`);
if (missing.length) console.log(`unmatched climate cities (${missing.length}): ${missing.join(', ')}`);
