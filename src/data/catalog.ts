import type { CatalogItem } from '../types';

// Helpers to keep the catalog terse.
// `max` is the no-laundry ceiling (laundry roughly halves it — see computeQuantity).
const perDay = (factor: number, max: number) => ({ kind: 'perDay', factor, max }) as const;
const perTrip = (count: number) => ({ kind: 'perTrip', count }) as const;
const bucket = (weekend: number, week: number, long: number) =>
  ({ kind: 'bucket', weekend, week, long }) as const;
const none = () => ({ kind: 'none' }) as const;
const t = (key: string, weight = 1) => ({ key, weight });

/**
 * Built-in suggestion catalog (SPEC §4.6 / §5). An item is suggested if it is
 * `always` (essentials) or any of its tagKeys matches an active trip tag.
 * Multi-purpose items (e.g. merino base layer) link to several tags and surface
 * for any of them, deduped, with all matching reasons shown.
 */
export const CATALOG: CatalogItem[] = [
  // --- Essentials (always) ---
  { id: 'passport', name: 'Passport', category: 'Documents', always: true, essentialWhen: 'international', tagKeys: [], quantity: perTrip(1) },
  { id: 'id-card', name: 'ID / driving licence', category: 'Documents', always: true, essentialWhen: 'domestic', tagKeys: [], quantity: perTrip(1) },
  { id: 'visa-check', name: 'Check visa & entry rules', category: 'Documents', always: true, essentialWhen: 'international', tagKeys: [], quantity: none() },
  { id: 'wallet', name: 'Wallet & cards', category: 'Money & Cards', always: true, tagKeys: [], quantity: perTrip(1) },
  { id: 'cash', name: 'Some cash', category: 'Money & Cards', always: true, tagKeys: [], quantity: none() },
  { id: 'phone', name: 'Phone', category: 'Electronics', always: true, tagKeys: [], quantity: perTrip(1) },
  { id: 'phone-charger', name: 'Phone charger', category: 'Electronics', always: true, tagKeys: [], quantity: perTrip(1) },
  { id: 'keys', name: 'Keys', category: 'Comfort & Misc', always: true, tagKeys: [], quantity: none() },
  { id: 'meds', name: 'Medications', category: 'Toiletries & Health', always: true, tagKeys: [], quantity: none() },
  { id: 'toothbrush', name: 'Toothbrush', category: 'Toiletries & Health', always: true, tagKeys: [], quantity: perTrip(1) },
  { id: 'toothpaste', name: 'Toothpaste', category: 'Toiletries & Health', always: true, tagKeys: [], quantity: perTrip(1) },
  { id: 'deodorant', name: 'Deodorant', category: 'Toiletries & Health', always: true, tagKeys: [], quantity: perTrip(1) },
  { id: 'shampoo', name: 'Shampoo / soap', category: 'Toiletries & Health', always: true, tagKeys: [], quantity: perTrip(1) },
  { id: 'underwear', name: 'Underwear', category: 'Clothing', always: true, tagKeys: [], quantity: perDay(1, 30) },
  { id: 'socks', name: 'Socks', category: 'Clothing', always: true, tagKeys: [], quantity: perDay(1, 30) },
  { id: 'tshirts', name: 'T-shirts', category: 'Clothing', always: true, tagKeys: [], quantity: perDay(1, 21) },
  { id: 'trousers', name: 'Trousers', category: 'Clothing', always: true, tagKeys: [], quantity: bucket(1, 2, 3) },
  { id: 'sleepwear', name: 'Sleepwear', category: 'Clothing', always: true, tagKeys: [], quantity: perTrip(1) },
  { id: 'everyday-shoes', name: 'Everyday shoes', category: 'Footwear', always: true, tagKeys: [], quantity: perTrip(1) },

  // --- Beach / swimming ---
  { id: 'swimwear', name: 'Swimwear', category: 'Clothing', tagKeys: [t('beach', 2), t('swimming', 2)], quantity: perTrip(1) },
  { id: 'beach-towel', name: 'Beach towel', category: 'Gear & Equipment', tagKeys: [t('beach', 2)], quantity: perTrip(1) },
  { id: 'flip-flops', name: 'Flip-flops', category: 'Footwear', tagKeys: [t('beach', 2), t('hot', 1)], quantity: perTrip(1) },
  { id: 'goggles', name: 'Swim goggles', category: 'Gear & Equipment', tagKeys: [t('swimming', 2)], quantity: perTrip(1) },

  // --- Hiking ---
  { id: 'hiking-boots', name: 'Hiking boots', category: 'Footwear', tagKeys: [t('hiking', 2)], quantity: perTrip(1) },
  { id: 'hiking-socks', name: 'Hiking socks', category: 'Clothing', tagKeys: [t('hiking', 1)], quantity: perDay(0.5, 8) },
  { id: 'daypack', name: 'Daypack', category: 'Gear & Equipment', tagKeys: [t('hiking', 2), t('photography', 1)], quantity: perTrip(1) },
  { id: 'water-bottle', name: 'Water bottle', category: 'Gear & Equipment', tagKeys: [t('hiking', 1), t('running', 1), t('cycling', 1)], quantity: perTrip(1) },
  { id: 'merino', name: 'Merino base layer', category: 'Clothing', tagKeys: [t('hiking', 2), t('cold', 2)], quantity: bucket(1, 2, 3) },
  { id: 'trekking-poles', name: 'Trekking poles', category: 'Gear & Equipment', tagKeys: [t('hiking', 1)], quantity: perTrip(1) },

  // --- Surfing ---
  { id: 'boardshorts', name: 'Boardshorts', category: 'Clothing', tagKeys: [t('surfing', 2), t('hot', 1)], quantity: perTrip(1) },
  { id: 'wetsuit', name: 'Wetsuit', category: 'Gear & Equipment', tagKeys: [t('surfing', 2)], quantity: perTrip(1) },
  { id: 'rashguard', name: 'Rash guard', category: 'Clothing', tagKeys: [t('surfing', 1)], quantity: perTrip(1) },

  // --- Skiing ---
  { id: 'ski-jacket', name: 'Ski jacket', category: 'Clothing', tagKeys: [t('skiing', 2), t('cold', 1)], quantity: perTrip(1) },
  { id: 'ski-gloves', name: 'Ski gloves', category: 'Clothing', tagKeys: [t('skiing', 2)], quantity: perTrip(1) },
  { id: 'goggles-ski', name: 'Ski goggles', category: 'Gear & Equipment', tagKeys: [t('skiing', 2)], quantity: perTrip(1) },
  { id: 'beanie', name: 'Beanie', category: 'Clothing', tagKeys: [t('skiing', 1), t('cold', 2)], quantity: perTrip(1) },

  // --- Camping ---
  { id: 'tent', name: 'Tent', category: 'Gear & Equipment', tagKeys: [t('camping', 2)], quantity: perTrip(1) },
  { id: 'sleeping-bag', name: 'Sleeping bag', category: 'Gear & Equipment', tagKeys: [t('camping', 2)], quantity: perTrip(1) },
  { id: 'headlamp', name: 'Headlamp', category: 'Gear & Equipment', tagKeys: [t('camping', 2), t('hiking', 1)], quantity: perTrip(1) },
  { id: 'camp-stove', name: 'Camping stove', category: 'Gear & Equipment', tagKeys: [t('camping', 1)], quantity: perTrip(1) },

  // --- Running / cycling ---
  { id: 'running-shoes', name: 'Running shoes', category: 'Footwear', tagKeys: [t('running', 2)], quantity: perTrip(1) },
  { id: 'sportswear', name: 'Sportswear', category: 'Clothing', tagKeys: [t('running', 1), t('cycling', 1)], quantity: bucket(1, 2, 3) },
  { id: 'helmet', name: 'Helmet', category: 'Gear & Equipment', tagKeys: [t('cycling', 2)], quantity: perTrip(1) },

  // --- Business / formal ---
  { id: 'laptop', name: 'Laptop', category: 'Electronics', tagKeys: [t('business', 2)], quantity: perTrip(1) },
  { id: 'laptop-charger', name: 'Laptop charger', category: 'Electronics', tagKeys: [t('business', 2)], quantity: perTrip(1) },
  { id: 'dress-shirt', name: 'Dress shirt', category: 'Clothing', tagKeys: [t('business', 1), t('formal', 1)], quantity: bucket(1, 3, 5) },
  { id: 'dress-shoes', name: 'Dress shoes', category: 'Footwear', tagKeys: [t('formal', 2), t('business', 1)], quantity: perTrip(1) },
  { id: 'formal-outfit', name: 'Formal outfit', category: 'Clothing', tagKeys: [t('formal', 2)], quantity: perTrip(1) },

  // --- Photography ---
  { id: 'camera', name: 'Camera', category: 'Electronics', tagKeys: [t('photography', 2)], quantity: perTrip(1) },
  { id: 'camera-charger', name: 'Camera charger & cards', category: 'Electronics', tagKeys: [t('photography', 1)], quantity: perTrip(1) },

  // --- Climbing ---
  { id: 'climbing-shoes', name: 'Climbing shoes', category: 'Footwear', tagKeys: [t('climbing', 2)], quantity: perTrip(1) },
  { id: 'harness', name: 'Climbing harness', category: 'Gear & Equipment', tagKeys: [t('climbing', 2)], quantity: perTrip(1) },
  { id: 'chalk-bag', name: 'Chalk bag', category: 'Gear & Equipment', tagKeys: [t('climbing', 1)], quantity: perTrip(1) },
  { id: 'belay-device', name: 'Belay device', category: 'Gear & Equipment', tagKeys: [t('climbing', 1)], quantity: perTrip(1) },

  // --- BBQ ---
  { id: 'bbq-tools', name: 'BBQ tools & tongs', category: 'Gear & Equipment', tagKeys: [t('bbq', 2)], quantity: perTrip(1) },
  { id: 'lighter', name: 'Lighter / matches', category: 'Gear & Equipment', tagKeys: [t('bbq', 1), t('camping', 1)], quantity: perTrip(1) },
  { id: 'apron', name: 'Apron', category: 'Comfort & Misc', tagKeys: [t('bbq', 1)], quantity: perTrip(1) },

  // --- Road trip ---
  { id: 'car-charger', name: 'Car phone charger', category: 'Electronics', tagKeys: [t('road trip', 2)], quantity: perTrip(1) },
  { id: 'snacks', name: 'Road snacks', category: 'Comfort & Misc', tagKeys: [t('road trip', 1)], quantity: none() },
  { id: 'cooler', name: 'Cool box', category: 'Gear & Equipment', tagKeys: [t('road trip', 1), t('camping', 1), t('bbq', 1)], quantity: perTrip(1) },

  // --- Festival ---
  { id: 'earplugs', name: 'Earplugs', category: 'Comfort & Misc', tagKeys: [t('festival', 1)], quantity: perTrip(1) },
  { id: 'poncho', name: 'Rain poncho', category: 'Clothing', tagKeys: [t('festival', 1), t('rainy', 1)], quantity: perTrip(1) },
  { id: 'wellies', name: 'Wellington boots', category: 'Footwear', tagKeys: [t('festival', 1), t('rainy', 1)], quantity: perTrip(1) },
  { id: 'hand-sanitizer', name: 'Hand sanitizer', category: 'Toiletries & Health', tagKeys: [t('festival', 1)], quantity: perTrip(1) },

  // --- Shared add-ons ---
  { id: 'power-bank', name: 'Power bank', category: 'Electronics', tagKeys: [t('festival', 2), t('road trip', 1), t('photography', 1)], quantity: perTrip(1) },
  { id: 'first-aid', name: 'First-aid kit', category: 'Toiletries & Health', tagKeys: [t('camping', 1), t('hiking', 1), t('climbing', 1), t('road trip', 1)], quantity: perTrip(1) },

  // --- Weather ---
  { id: 'sunscreen', name: 'Sunscreen', category: 'Toiletries & Health', tagKeys: [t('hot', 2), t('sunny', 2), t('beach', 1)], quantity: perTrip(1) },
  { id: 'sunglasses', name: 'Sunglasses', category: 'Comfort & Misc', tagKeys: [t('sunny', 2), t('hot', 1), t('beach', 1)], quantity: perTrip(1) },
  { id: 'sun-hat', name: 'Sun hat', category: 'Clothing', tagKeys: [t('hot', 1), t('sunny', 1)], quantity: perTrip(1) },
  { id: 'sandals', name: 'Sandals', category: 'Footwear', tagKeys: [t('hot', 1)], quantity: perTrip(1) },
  { id: 'warm-jacket', name: 'Warm jacket', category: 'Clothing', tagKeys: [t('cold', 2)], quantity: perTrip(1) },
  { id: 'gloves', name: 'Gloves', category: 'Clothing', tagKeys: [t('cold', 1)], quantity: perTrip(1) },
  { id: 'scarf', name: 'Scarf', category: 'Clothing', tagKeys: [t('cold', 1)], quantity: perTrip(1) },
  { id: 'rain-jacket', name: 'Rain jacket', category: 'Clothing', tagKeys: [t('rainy', 2), t('hiking', 1)], quantity: perTrip(1) },
  { id: 'umbrella', name: 'Umbrella', category: 'Comfort & Misc', tagKeys: [t('rainy', 1)], quantity: perTrip(1) },
  { id: 'windbreaker', name: 'Windbreaker', category: 'Clothing', tagKeys: [t('windy', 2), t('cycling', 1)], quantity: perTrip(1) },

  // Tropical — insect protection, heat & health (manual "tropical" tag)
  { id: 'insect-repellent', name: 'Insect repellent', category: 'Toiletries & Health', tagKeys: [t('tropical', 2), t('camping', 1), t('hiking', 1)], quantity: perTrip(1) },
  { id: 'mosquito-net', name: 'Mosquito net', category: 'Gear & Equipment', tagKeys: [t('tropical', 1), t('camping', 1)], quantity: perTrip(1) },
  { id: 'rehydration-salts', name: 'Rehydration salts', category: 'Toiletries & Health', tagKeys: [t('tropical', 1), t('hot', 1)], quantity: none() },
  { id: 'light-long-sleeve', name: 'Light long-sleeve top', category: 'Clothing', tagKeys: [t('tropical', 1)], quantity: bucket(1, 2, 3) },
  { id: 'vaccination-check', name: 'Check vaccinations & travel clinic', category: 'Documents', tagKeys: [t('tropical', 1)], quantity: none() },
];
