// Packing rules and calculations: weights, progress, carry-on checks.
import { data, find, save } from './store.js';
import { uid, unique, norm, addDays, daysUntil, plural } from './util.js';

export const BAG_KINDS = {
  checked: 'Checked bag',
  cabin: 'Carry-on',
  personal: 'Personal item',
  worn: 'On me / wearing',
  other: 'Other (not flown)',
};
// Bags that travel in the aircraft cabin, so lithium batteries are allowed in them.
export const CABIN_KINDS = ['cabin', 'personal', 'worn'];
export const PLAN = { pack: 'Packing', leave: 'Leave behind', home: 'Send home' };
export const STATUS = { own: 'Own', buy: 'Need to buy', borrow: 'Borrowing' };

export const sortedTrips = () => [...data.trips].sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999'));
export const tripItems = (tripId) => data.tripItems.filter((t) => t.tripId === tripId && find('items', t.itemId));
export const itemOf = (ti) => find('items', ti.itemId);
export const bagOf = (trip, bagId) => (bagId ? trip.bags.find((b) => b.id === bagId) : null);
export const tiWeight = (ti) => (Number(itemOf(ti)?.weight) || 0) * (Number(ti.qty) || 1);

export function bagStats(trip, bag) {
  const tis = tripItems(trip.id).filter((t) => t.bagId === bag.id && t.plan === 'pack');
  const weight = (Number(bag.tare) || 0) + tis.reduce((s, t) => s + tiWeight(t), 0);
  const limit = bag.limit ? bag.limit * 1000 : null;
  return {
    count: tis.length,
    packed: tis.filter((t) => t.packed).length,
    weight,
    limit,
    over: limit != null && weight > limit,
    near: limit != null && weight > limit * 0.9 && weight <= limit,
  };
}

export function carryIssue(trip, ti) {
  if (ti.plan !== 'pack' || !itemOf(ti)?.carryOn) return false;
  const bag = bagOf(trip, ti.bagId);
  return !!bag && !CABIN_KINDS.includes(bag.kind);
}

export function tripStats(trip) {
  const tis = tripItems(trip.id);
  const active = tis.filter((t) => t.plan === 'pack');
  const bags = trip.bags.map((b) => ({ bag: b, ...bagStats(trip, b) }));
  return {
    total: tis.length,
    done: tis.filter((t) => t.packed).length,
    weight: active.reduce((s, t) => s + tiWeight(t), 0) + trip.bags.reduce((s, b) => s + (Number(b.tare) || 0), 0),
    bags,
    overBags: bags.filter((b) => b.over),
    carryIssues: tis.filter((t) => carryIssue(trip, t)),
    loose: active.filter((t) => !bagOf(trip, t.bagId)).length,
  };
}

export function nextTripAfter(trip) {
  const list = sortedTrips();
  return list[list.findIndex((t) => t.id === trip.id) + 1] || null;
}

export const locations = () => unique(['With me', 'Switzerland', 'UK', ...data.items.map((i) => i.location)]);
export const categories = () => unique(data.items.map((i) => i.category)).sort();
export const brands = () => unique(data.items.map((i) => i.brand)).sort((a, b) => a.localeCompare(b));
// "Black Diamond Recon LT" – empty for generic items without a brand or model.
export const makeModel = (i) => [i.brand, i.model].filter(Boolean).join(' ');
// False while the weight field is blank. 0 g counts as weighed (e.g. documents).
export const hasWeight = (i) => i.weight != null && i.weight !== '' && Number.isFinite(Number(i.weight));

// ---------- Condition and servicing ----------
export const CONDITION = { good: 'Good', worn: 'Worn', repair: 'Needs repair', retired: 'Retired' };
export const conditionOf = (i) => (CONDITION[i.condition] ? i.condition : 'good');

// Suggested service tasks for an item, based on its category and name: [task, every n days].
export function suggestedServices(i) {
  const cat = norm(i.category);
  const name = norm(i.name);
  const out = [];
  if (cat === 'skis') out.push(['Wax', 21], ['Bindings check (screws, release)', 180]);
  if (cat === 'skins') out.push(['Glue check', 60]);
  if (name.includes('transceiver')) out.push(['Battery and self-check', 30]);
  if (name.includes('airbag')) out.push(['Trigger and canister / battery check', 365]);
  return out.map(([task, every]) => ({ id: uid(), task, every }));
}

// Service log entries for one item, newest first.
export const serviceLog = (itemId) =>
  data.services.filter((s) => s.itemId === itemId).sort((a, b) => b.date.localeCompare(a.date));

// Each service task with when it was last done and when it is next due.
// A task that has never been logged counts as due, so logging it the first time starts the clock.
export function serviceStatus(item) {
  const log = serviceLog(item.id);
  return (item.services || []).map((sv) => {
    const last = log.find((s) => norm(s.task) === norm(sv.task)) || null;
    const due = last && sv.every ? addDays(last.date, Number(sv.every)) : null;
    const days = due ? daysUntil(due) : null;
    return { ...sv, last, due, days, overdue: !!sv.every && (!last || days <= 0) };
  });
}

// Why an item needs attention (empty when it doesn't). Retired items never do.
export function dueReasons(item) {
  const c = conditionOf(item);
  if (c === 'retired' || item.status !== 'own') return [];
  const reasons = c === 'repair' ? ['Needs repair'] : [];
  for (const s of serviceStatus(item)) {
    if (!s.overdue) continue;
    reasons.push(s.last ? `${s.task}: ${s.days === 0 ? 'due today' : `${plural(-s.days, 'day')} overdue`}` : `${s.task}: never logged`);
  }
  return reasons;
}

export const dueItems = () =>
  data.items.map((item) => ({ item, reasons: dueReasons(item) })).filter((d) => d.reasons.length);

// Picks a sensible bag for an item being added to a trip.
export function guessBag(trip, item) {
  if (item.carryOn) {
    const cabin = trip.bags.find((b) => b.kind === 'cabin') || trip.bags.find((b) => CABIN_KINDS.includes(b.kind));
    if (cabin) return cabin.id;
  }
  // Reuse the bag this item was in on another trip, if this trip has a bag with the same name.
  for (const ti of data.tripItems) {
    if (ti.itemId !== item.id || ti.tripId === trip.id || !ti.bagId) continue;
    const other = find('trips', ti.tripId);
    const name = other && bagOf(other, ti.bagId)?.name;
    const match = name && trip.bags.find((b) => norm(b.name) === norm(name));
    if (match) return match.id;
  }
  return null;
}

// Adds inventory items to a trip, skipping ones already on it. Returns how many were added.
export async function addToTrip(trip, itemIds, bagId = 'auto') {
  const have = new Set(data.tripItems.filter((t) => t.tripId === trip.id).map((t) => t.itemId));
  const objs = [];
  for (const id of itemIds) {
    const item = find('items', id);
    if (!item || have.has(id)) continue;
    have.add(id);
    objs.push({
      id: uid(),
      tripId: trip.id,
      itemId: id,
      bagId: bagId === 'auto' ? guessBag(trip, item) : bagId || null,
      qty: Number(item.qty) || 1,
      packed: false,
      plan: 'pack',
    });
  }
  if (objs.length) await save('tripItems', ...objs);
  return objs.length;
}

export function tripsUsing(itemId) {
  return data.tripItems
    .filter((t) => t.itemId === itemId)
    .map((t) => ({ ti: t, trip: find('trips', t.tripId) }))
    .filter((x) => x.trip);
}
