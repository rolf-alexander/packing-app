// Starter data loaded the first time the app opens. Everything here can be edited or deleted in the app.
import { data, meta, save, setMeta } from './store.js';
import { uid } from './util.js';
import { suggestedServices } from './model.js';

// [key, name, brand, model, category, quantity, status, notes]
// Weights are left blank on purpose: weigh each item and fill it in (Gear → Missing weight).
const GEAR = [
  ['atris', 'Touring skis', 'Black Crows', 'Atris 184 cm', 'Skis', 1, 'own', '105 mm underfoot. Bindings: ATK Raider 13 Evo'],
  ['prodigy', 'Resort / freestyle skis', 'Faction', 'Prodigy 1 184 cm', 'Skis', 1, 'own', '88 mm underfoot. Bindings: Marker Strive 12'],
  ['chetler', 'Freeride touring skis', 'Atomic', 'Bent Chetler 120 184 cm', 'Skis', 1, 'buy', 'Planned bindings: ATK Raider 13 Evo + Freeride Spacer'],
  ['skins', 'Climbing skins (Atris)', '', '', 'Skins', 1, 'own'],
  ['chskins', 'Climbing skins (Bent Chetler)', '', '', 'Skins', 1, 'buy'],
  ['scarpa', 'Touring boots', 'Scarpa', '4-Quattro Pro LE', 'Boots', 1, 'own', 'Size 28.5, BSL 316 mm. Main boots for Japan and Canada'],
  ['tecnica', 'Touring boots (spare)', 'Tecnica', 'Zero G Tour Pro', 'Boots', 1, 'own', 'Size 28.5. Walk mechanism broke and was repaired twice; not skied since'],
  ['poles', 'Poles', 'Black Diamond', 'Traverse Pro 145', 'Poles', 1, 'own'],
  ['beacon', 'Avalanche transceiver', '', '', 'Avalanche safety', 1, 'own', 'Carry spare batteries'],
  ['shovel', 'Avalanche shovel', '', '', 'Avalanche safety', 1, 'own'],
  ['probe', 'Avalanche probe', '', '', 'Avalanche safety', 1, 'own'],
  ['airbag', 'Avalanche airbag pack', '', '', 'Avalanche safety', 1, 'own', 'Gas canister or battery: check the airline rules and get approval before you fly'],
  ['axe', 'Ice axe', '', '', 'Mountaineering', 1, 'own'],
  ['crampons', 'Boot crampons', '', '', 'Mountaineering', 1, 'own'],
  ['straps', 'Ski straps', 'Voilé', '', 'Tools & accessories', 1, 'own'],
  ['tuning', 'Ski tuning kit', '', '', 'Tools & accessories', 1, 'own'],
  ['thermos', 'Thermos flask', '', '', 'Tools & accessories', 1, 'own'],
  ['shellj', 'Hardshell jacket', '', '', 'Clothing', 1, 'own'],
  ['shellp', 'Hardshell trousers', '', '', 'Clothing', 1, 'own'],
  ['puffy', 'Hooded puffy', '', '', 'Clothing', 1, 'own'],
  ['base', 'Merino base layers', '', '', 'Clothing', 1, 'own'],
  ['wind', 'Windshell', 'Black Diamond', 'Alpine Start (M)', 'Clothing', 1, 'own'],
  ['a90', 'Half-zip crewneck', 'Senchi', 'A90 Half-Zip Crewneck', 'Clothing', 4, 'own'],
  ['a120', 'Half-zip pocket hoodie', 'Senchi', 'A120 Half-Zip Pocket Hoodie', 'Clothing', 1, 'own'],
  ['balaclava', 'Balaclavas', '', '', 'Clothing', 1, 'own'],
  ['goggles', 'Goggles + low-light lens', 'Smith', 'Squad XL', 'Helmet & goggles', 1, 'own'],
  ['helmet', 'Ski helmet', '', '', 'Helmet & goggles', 1, 'own'],
  ['pack', 'Backpack', 'Exped', 'Skyline 45', 'Packs', 1, 'own'],
  ['gpchest', 'GoPro chest mount', 'GoPro', '', 'Filming', 1, 'own'],
  ['gphelmet', 'GoPro helmet mount', 'GoPro', '', 'Filming', 1, 'own'],
];

const TEMPLATES = {
  'Ski touring': 'atris skins scarpa poles beacon shovel probe airbag axe crampons straps thermos helmet goggles',
  'Resort skiing': 'prodigy scarpa poles helmet goggles gpchest gphelmet',
  'Ski clothing': 'shellj shellp puffy base wind a90 a120 balaclava',
};

const CHECKS = [
  'Transceiver on, battery above 50 %',
  'Transceiver group check done',
  'Probe and shovel in pack',
  'Airbag pack armed (canister / battery checked)',
  'Avalanche bulletin and weather checked',
  'Route plan shared, with expected return time',
  'Phone fully charged, offline maps downloaded',
  'Skins, ski crampons and ski straps',
  'First aid kit and repair kit',
  'Food, water and a hot drink',
  'Spare warm layer and gloves',
  'Head torch',
  'Sun cream, goggles and sunglasses',
  'Local emergency number saved',
];

export async function seedStarter() {
  const ref = {};
  const items = GEAR.map(([key, name, brand, model, category, qty, status, notes = '']) => {
    const id = uid();
    ref[key] = id;
    const item = { id, name, brand, model, category, weight: null, qty, carryOn: false, status, location: '', price: null, shop: '', notes, photo: null, condition: 'good' };
    item.services = suggestedServices(item);
    return item;
  });
  await save('items', ...items);

  const templates = Object.entries(TEMPLATES).map(([name, keys]) => ({
    id: uid(),
    name,
    itemIds: keys.split(' ').map((k) => {
      if (!ref[k]) throw new Error(`Unknown starter item ${k}`);
      return ref[k];
    }),
  }));
  await save('templates', ...templates);

  await save('checks', ...CHECKS.map((text, order) => ({ id: uid(), text, order })));
  await setMeta('seeded', true);
  await setMeta('serviceDefaults', true);
}

export async function seedIfEmpty() {
  if (meta('seeded')) return addServiceDefaults();
  if (data.items.length || data.trips.length) {
    await setMeta('seeded', true);
    return addServiceDefaults();
  }
  await seedStarter();
}

// Runs once on devices that had gear before servicing existed: gives each item the suggested
// service tasks (wax, glue check…). You can change or remove them on the item screen.
async function addServiceDefaults() {
  if (meta('serviceDefaults')) return;
  const changed = data.items.filter((i) => !i.services);
  for (const i of changed) i.services = suggestedServices(i);
  if (changed.length) await save('items', ...changed);
  await setMeta('serviceDefaults', true);
}
