// Starter data loaded the first time the app opens. Everything here can be edited or deleted in the app.
import { data, meta, save, setMeta } from './store.js';
import { uid, addDays, todayKey } from './util.js';

// [key, name, category, grams each, quantity, must go in carry-on, usual bag, notes]
// "usual bag" is only used to pre-fill the trips: ski / checked / cabin / worn.
const GEAR = [
  ['tskis', 'Touring skis + bindings', 'Ski touring', 3000, 1, 0, 'ski'],
  ['skins', 'Climbing skins', 'Ski touring', 450, 1, 0, 'ski'],
  ['crampons', 'Ski crampons', 'Ski touring', 250, 1, 0, 'ski'],
  ['tboots', 'Touring boots', 'Ski touring', 2800, 1, 0, 'checked', 'Wear them on the plane if your bags are heavy'],
  ['poles', 'Adjustable poles', 'Ski touring', 500, 1, 0, 'ski'],
  ['tpack', 'Touring backpack (30 L)', 'Ski touring', 1100, 1, 0, 'cabin', 'Doubles as carry-on bag'],
  ['straps', 'Ski straps', 'Ski touring', 25, 4, 0, 'ski'],
  ['wax', 'Skin wax', 'Ski touring', 60, 1, 0, 'ski'],
  ['thermos', 'Thermos flask', 'Ski touring', 400, 1, 0, 'checked'],
  ['torch', 'Head torch', 'Ski touring', 80, 1, 1, 'cabin', 'Rechargeable lithium battery'],
  ['beacon', 'Avalanche transceiver', 'Avalanche safety', 210, 1, 0, 'cabin', 'Carry spare AAA batteries'],
  ['probe', 'Avalanche probe', 'Avalanche safety', 280, 1, 0, 'ski'],
  ['shovel', 'Avalanche shovel', 'Avalanche safety', 550, 1, 0, 'ski'],
  ['airbag', 'Avalanche airbag pack', 'Avalanche safety', 2600, 1, 0, 'checked', 'Gas canister or battery: check the airline rules and get approval before you fly'],
  ['rskis', 'Resort skis', 'Resort skiing', 3800, 1, 0, 'ski'],
  ['rboots', 'Ski boots', 'Resort skiing', 3400, 1, 0, 'checked'],
  ['helmet', 'Ski helmet', 'Resort skiing', 450, 1, 0, 'checked'],
  ['goggles', 'Ski goggles', 'Resort skiing', 200, 1, 0, 'cabin'],
  ['lens', 'Spare goggle lens (low light)', 'Resort skiing', 60, 1, 0, 'checked'],
  ['passholder', 'Ski pass holder', 'Resort skiing', 20, 1, 0, 'checked'],
  ['shellj', 'Hardshell jacket', 'Ski clothing', 450, 1, 0, 'worn'],
  ['shellp', 'Hardshell trousers', 'Ski clothing', 500, 1, 0, 'checked'],
  ['down', 'Down jacket', 'Ski clothing', 350, 1, 0, 'worn'],
  ['fleece', 'Fleece midlayer', 'Ski clothing', 300, 1, 0, 'checked'],
  ['basetop', 'Merino base layer top', 'Ski clothing', 180, 2, 0, 'checked'],
  ['basebot', 'Merino base layer bottoms', 'Ski clothing', 160, 2, 0, 'checked'],
  ['skisocks', 'Ski socks', 'Ski clothing', 80, 3, 0, 'checked'],
  ['gloves', 'Warm ski gloves', 'Ski clothing', 200, 1, 0, 'checked'],
  ['lgloves', 'Light touring gloves', 'Ski clothing', 80, 1, 0, 'checked'],
  ['buff', 'Neck gaiter / buff', 'Ski clothing', 40, 2, 0, 'checked'],
  ['beanie', 'Beanie', 'Ski clothing', 60, 1, 0, 'worn'],
  ['sunnies', 'Sunglasses', 'Ski clothing', 30, 1, 0, 'cabin'],
  ['tshirts', 'T-shirts', 'Clothing', 150, 5, 0, 'checked'],
  ['undies', 'Underwear', 'Clothing', 60, 7, 0, 'checked'],
  ['socks', 'Everyday socks', 'Clothing', 50, 7, 0, 'checked'],
  ['trousers', 'Trousers / jeans', 'Clothing', 600, 2, 0, 'checked'],
  ['jumper', 'Jumper', 'Clothing', 450, 1, 0, 'checked'],
  ['trainers', 'Trainers', 'Clothing', 700, 1, 0, 'worn'],
  ['wboots', 'Winter boots', 'Clothing', 1200, 1, 0, 'checked'],
  ['pjs', 'Pyjamas', 'Clothing', 300, 1, 0, 'checked'],
  ['swim', 'Swim shorts', 'Clothing', 150, 1, 0, 'checked'],
  ['shirts', 'Work shirts', 'Work', 220, 3, 0, 'checked'],
  ['smartp', 'Smart trousers', 'Work', 500, 1, 0, 'checked'],
  ['smarts', 'Smart shoes', 'Work', 900, 1, 0, 'checked'],
  ['notebook', 'Notebook and pens', 'Work', 300, 1, 0, 'cabin'],
  ['contract', 'Placement contract and paperwork', 'Documents', 50, 1, 0, 'cabin'],
  ['phone', 'Phone', 'Electronics', 200, 1, 1, 'worn'],
  ['laptop', 'Laptop', 'Electronics', 1400, 1, 1, 'cabin'],
  ['lcharger', 'Laptop charger', 'Electronics', 300, 1, 0, 'cabin'],
  ['pbank', 'Power bank (20,000 mAh)', 'Electronics', 350, 1, 1, 'cabin', 'Carry-on only. Most airlines allow up to 100 Wh without approval'],
  ['pcharger', 'Phone charger + USB-C cables', 'Electronics', 120, 1, 0, 'cabin'],
  ['adapter', 'Universal travel adapter', 'Electronics', 150, 1, 0, 'cabin', 'Germany: type F · UK: type G · Japan and Canada: type A/B'],
  ['headphones', 'Headphones', 'Electronics', 250, 1, 1, 'cabin'],
  ['gopro', 'GoPro', 'Filming', 155, 2, 1, 'cabin'],
  ['gpbatt', 'GoPro batteries', 'Filming', 30, 6, 1, 'cabin', 'Lithium: carry-on only'],
  ['gpcharger', 'GoPro battery charger', 'Filming', 80, 1, 0, 'cabin'],
  ['gpmounts', 'GoPro mounts (helmet, chest, clamp)', 'Filming', 200, 1, 0, 'checked'],
  ['drone', 'Drone', 'Filming', 249, 1, 1, 'cabin', 'Check the drone rules in each country before flying'],
  ['dbatt', 'Drone batteries', 'Filming', 80, 3, 1, 'cabin', 'Lithium: carry-on only, ideally in a LiPo bag'],
  ['dctrl', 'Drone controller', 'Filming', 390, 1, 1, 'cabin', 'Has a built-in lithium battery'],
  ['dhub', 'Drone charging hub', 'Filming', 150, 1, 0, 'cabin'],
  ['nd', 'Drone ND filters', 'Filming', 20, 1, 0, 'cabin'],
  ['sd', 'microSD cards', 'Filming', 1, 6, 0, 'cabin'],
  ['ssd', 'Portable SSD (backups)', 'Filming', 60, 1, 0, 'cabin'],
  ['pole', 'Selfie pole', 'Filming', 200, 1, 0, 'checked'],
  ['tripod', 'Mini tripod', 'Filming', 150, 1, 0, 'checked'],
  ['lipo', 'LiPo safe bag', 'Filming', 100, 1, 0, 'cabin'],
  ['passport', 'Passport', 'Documents', 40, 1, 0, 'worn'],
  ['wallet', 'Wallet + bank cards', 'Travel essentials', 100, 1, 0, 'worn'],
  ['bottle', 'Water bottle', 'Travel essentials', 150, 1, 0, 'cabin', 'Empty it before security'],
  ['cubes', 'Packing cubes', 'Travel essentials', 100, 3, 0, 'checked'],
  ['earplugs', 'Earplugs + eye mask', 'Travel essentials', 30, 1, 0, 'cabin'],
  ['lock', 'Luggage lock', 'Travel essentials', 50, 1, 0, 'checked'],
  ['laundry', 'Laundry bag', 'Travel essentials', 60, 1, 0, 'checked'],
  ['pillow', 'Travel pillow', 'Travel essentials', 300, 1, 0, 'cabin'],
  ['washbag', 'Wash bag', 'Toiletries', 120, 1, 0, 'checked'],
  ['teeth', 'Toothbrush + toothpaste', 'Toiletries', 120, 1, 0, 'checked'],
  ['deo', 'Deodorant', 'Toiletries', 80, 1, 0, 'checked'],
  ['shampoo', 'Shampoo + shower gel', 'Toiletries', 250, 1, 0, 'checked'],
  ['razor', 'Razor', 'Toiletries', 60, 1, 0, 'checked'],
  ['suncream', 'Sun cream SPF 50', 'Toiletries', 120, 1, 0, 'checked'],
  ['lipbalm', 'Lip balm with SPF', 'Toiletries', 10, 1, 0, 'cabin'],
  ['meds', 'Personal medication', 'Toiletries', 100, 1, 0, 'cabin', 'Keep in your carry-on'],
  ['liquids', 'Clear liquids bag (100 ml)', 'Toiletries', 20, 1, 0, 'cabin'],
  ['firstaid', 'First aid kit', 'First aid & repair', 300, 1, 0, 'checked'],
  ['blister', 'Blister kit', 'First aid & repair', 50, 1, 0, 'checked'],
  ['repair', 'Ski repair kit (multi-tool, tape, wire)', 'First aid & repair', 250, 1, 0, 'ski', 'Multi-tool must go in checked baggage'],
  ['bivvy', 'Emergency bivvy bag', 'First aid & repair', 200, 1, 0, 'ski'],
  ['licence', 'Driving licence', 'Documents', 10, 1, 0, 'worn'],
  ['insurance', 'Travel insurance details', 'Documents', 0, 1, 0, 'worn', 'Policy number and emergency phone number saved offline'],
  ['bookings', 'Booking confirmations (offline copies)', 'Documents', 0, 1, 0, 'cabin'],
  ['healthcard', 'Health insurance card', 'Documents', 5, 1, 0, 'worn'],
];

const TEMPLATES = {
  'Ski touring': 'tskis skins crampons tboots poles tpack straps wax thermos torch beacon probe shovel airbag helmet goggles repair bivvy firstaid',
  'Resort skiing': 'rskis rboots helmet goggles lens passholder',
  'Ski clothing': 'shellj shellp down fleece basetop basebot skisocks gloves lgloves buff beanie sunnies',
  'Filming kit': 'gopro gpbatt gpcharger gpmounts drone dbatt dctrl dhub nd sd ssd pole tripod lipo pbank',
  'Travel essentials': 'phone pcharger pbank adapter headphones wallet bottle cubes earplugs lock laundry pillow',
  'Everyday clothing': 'tshirts undies socks trousers jumper trainers wboots pjs swim',
  Work: 'shirts smartp smarts notebook laptop lcharger contract',
  Toiletries: 'washbag teeth deo shampoo razor suncream lipbalm meds liquids blister',
  Documents: 'passport licence insurance bookings healthcard',
};

// Bags: [usual-bag key, name, kind, limit kg, empty weight g]
const CITY_BAGS = [
  ['checked', 'Checked bag', 'checked', 23, 3500],
  ['cabin', 'Carry-on', 'cabin', 8, 2300],
  ['worn', 'On me', 'worn', null, 0],
];
const SKI_BAGS = [
  ['ski', 'Ski bag', 'checked', 23, 3500],
  ['checked', 'Checked bag', 'checked', 23, 3500],
  ['cabin', 'Carry-on (touring pack)', 'cabin', 8, 0],
  ['worn', 'On me', 'worn', null, 0],
];
const SKI_TEMPLATES = ['Ski touring', 'Resort skiing', 'Ski clothing', 'Filming kit', 'Travel essentials', 'Everyday clothing', 'Toiletries', 'Documents'];

// Tasks: [title, days relative to the trip start (negative = before), notes]
const TRIPS = [
  {
    name: 'Germany placement', destination: 'Germany', start: '2026-11-02', end: '2026-12-18', bags: CITY_BAGS,
    templates: ['Travel essentials', 'Everyday clothing', 'Work', 'Toiletries', 'Documents'],
    tasks: [
      ['Passport / ID valid for the whole stay', -14],
      ['Travel to Germany booked', -14],
      ['Placement contract signed and paperwork ready', -10],
      ['Accommodation confirmed', -10],
      ['Health and travel insurance cover the placement', -7],
      ['Bank card works in Germany without big fees', -3],
      ['Check if you must register your address (Anmeldung)', 7, 'Usually required within 2 weeks of moving into a flat in Germany'],
    ],
  },
  {
    name: 'UK Christmas', destination: 'United Kingdom', start: '2026-12-19', end: '2026-12-27', bags: CITY_BAGS,
    templates: ['Travel essentials', 'Everyday clothing', 'Toiletries', 'Documents'],
    tasks: [
      ['Travel to the UK booked', -30],
      ['Check whether you need a UK ETA', -21, 'Not needed for British or Irish citizens'],
      ['Christmas presents bought', -5],
      ['Decide what to leave in the UK and what goes to Japan', -2],
    ],
  },
  {
    name: 'Japan', destination: 'Japan', start: '2026-12-28', end: '2027-01-27', bags: SKI_BAGS, templates: SKI_TEMPLATES,
    tasks: [
      ['Flights booked', -60],
      ['Passport valid for the whole trip', -45],
      ['Accommodation booked', -30],
      ['Travel insurance covers ski touring, off-piste and rescue', -21, 'Check helicopter rescue and backcountry cover'],
      ['Check Japan entry requirements', -21],
      ['International Driving Permit (1949 convention)', -21, 'Needed to hire a car in Japan with most licences'],
      ['Car hire booked (winter tyres, 4WD)', -21],
      ['Ski bag booked with the airline', -14],
      ['Register the drone for flying in Japan', -14, 'Drones of 100 g or more must be registered; check local flight rules'],
      ['Data eSIM or pocket wifi sorted', -7],
      ['Avalanche forecasts and touring areas researched', -7],
      ['Fill in Visit Japan Web (immigration and customs QR codes)', -3],
    ],
  },
  {
    name: 'Canada', destination: 'Canada', start: '2027-01-28', end: '2027-03-15', bags: SKI_BAGS, templates: SKI_TEMPLATES,
    tasks: [
      ['Flights booked', -45],
      ['eTA or visa sorted', -21, 'Most visa-exempt travellers flying to Canada need an eTA'],
      ['Accommodation booked', -21],
      ['Travel insurance extended to Canada (incl. ski touring and rescue)', -14],
      ['Car hire booked (winter tyres)', -14],
      ['Ski bag booked with the airline', -14],
      ['Check Canadian drone rules', -14, 'Drones of 250 g or more need registration and a pilot certificate'],
      ['Avalanche Canada app installed and forecasts bookmarked', -7],
      ['Data eSIM sorted', -7],
    ],
  },
];

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

// Which bag to use if a trip doesn't have the item's usual bag.
const FALLBACK = { ski: ['ski', 'checked', 'cabin'], checked: ['checked', 'cabin'], cabin: ['cabin', 'checked'], worn: ['worn', 'cabin'] };

export async function seedStarter() {
  const today = todayKey();
  const ref = {};
  const items = GEAR.map(([key, name, category, weight, qty, carryOn, hint, notes = '']) => {
    const id = uid();
    ref[key] = { id, hint };
    return { id, name, category, weight, qty, carryOn: !!carryOn, status: 'own', location: 'With me', price: null, shop: '', notes, photo: null };
  });
  await save('items', ...items);

  const templates = Object.entries(TEMPLATES).map(([name, keys]) => ({
    id: uid(),
    name,
    itemIds: keys.split(' ').map((k) => {
      if (!ref[k]) throw new Error(`Unknown starter item ${k}`);
      return ref[k].id;
    }),
  }));
  await save('templates', ...templates);

  for (const t of TRIPS) {
    const bagByHint = {};
    const bags = t.bags.map(([hint, name, kind, limit, tare]) => {
      const bag = { id: uid(), name, kind, limit, tare };
      bagByHint[hint] = bag.id;
      return bag;
    });
    const trip = { id: uid(), name: t.name, destination: t.destination, start: t.start, end: t.end, notes: '', bags };
    await save('trips', trip);

    const added = new Set();
    const tis = [];
    for (const tplName of t.templates) {
      for (const key of TEMPLATES[tplName].split(' ')) {
        if (added.has(key)) continue;
        added.add(key);
        const { id, hint } = ref[key];
        const bagId = FALLBACK[hint].map((h) => bagByHint[h]).find(Boolean) || null;
        tis.push({ id: uid(), tripId: trip.id, itemId: id, bagId, qty: items.find((i) => i.id === id).qty, packed: false, plan: 'pack' });
      }
    }
    await save('tripItems', ...tis);

    const tasks = t.tasks.map(([title, offset, notes = '']) => {
      let due = addDays(t.start, offset);
      if (due < today) due = addDays(today, 3); // don't start with a wall of overdue tasks
      return { id: uid(), tripId: trip.id, title, due, notes, done: false };
    });
    await save('tasks', ...tasks);
  }

  await save('checks', ...CHECKS.map((text, order) => ({ id: uid(), text, order })));
  await setMeta('seeded', true);
}

export async function seedIfEmpty() {
  if (meta('seeded')) return;
  if (data.items.length || data.trips.length) return setMeta('seeded', true);
  await seedStarter();
}
