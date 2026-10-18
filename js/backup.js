// Backups and spreadsheet exports.
import { data, snapshot, replaceAll, save, setMeta } from './store.js';
import { toCSV, parseCSV, saveFile, todayKey, num, norm, uid } from './util.js';
import { ask, toast } from './ui.js';
import { tripsUsing, sortedTrips, tripItems, itemOf, bagOf, PLAN } from './model.js';

const BOM = '﻿'; // makes Excel open the file as UTF-8 (so ä, é, × show correctly)

export async function exportJSON() {
  const ok = await saveFile(`packlist-backup-${todayKey()}.json`, JSON.stringify(snapshot()), 'application/json');
  if (ok) {
    await setMeta('lastBackup', new Date().toISOString());
    toast('Backup saved');
  }
}

export async function importJSON(file) {
  let snap;
  try {
    snap = JSON.parse(await file.text());
  } catch {
    return toast('That file is not a valid backup');
  }
  if (snap?.app !== 'packing-app' || !Array.isArray(snap.items)) return toast('That file is not a backup from this app');
  const when = snap.exported ? new Date(snap.exported).toLocaleString('en-GB') : 'an unknown date';
  const ok = await ask(
    `Replace everything on this device with the backup from ${when}? (${snap.items.length} gear items, ${snap.trips?.length || 0} trips.) Anything added since then will be lost.`,
    { title: 'Restore backup', ok: 'Restore', danger: true },
  );
  if (!ok) return;
  await replaceAll(snap);
  toast('Backup restored');
}

const GEAR_COLS = ['name', 'brand', 'model', 'category', 'weight_g', 'quantity', 'status', 'location', 'carry_on', 'price_chf', 'where_to_buy', 'notes'];

export async function exportGearCSV() {
  const rows = [GEAR_COLS, ...[...data.items].sort((a, b) => a.name.localeCompare(b.name)).map((i) => [
    i.name, i.brand || '', i.model || '', i.category, i.weight, i.qty, i.status, i.location, i.carryOn ? 'yes' : 'no', i.price ?? '', i.shop, i.notes,
  ])];
  await saveFile(`packlist-gear-${todayKey()}.csv`, BOM + toCSV(rows), 'text/csv');
}

// Adds new items and updates existing ones. An item matches when its name is the same and, if the CSV
// has brand/model columns, its brand and model are the same too. Nothing is deleted.
export async function importGearCSV(file) {
  const rows = parseCSV(await file.text());
  if (rows.length < 2) return toast('That CSV file is empty');
  const head = rows[0].map((h) => norm(h).trim().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, ''));
  const col = (...names) => head.findIndex((h) => names.includes(h));
  const c = {
    name: col('name', 'item'), brand: col('brand', 'make', 'manufacturer'), model: col('model'), category: col('category'), weight: col('weight_g', 'weight', 'grams'), qty: col('quantity', 'qty'),
    status: col('status'), location: col('location', 'where'), carry: col('carry_on', 'carryon'), price: col('price_chf', 'price', 'unit_price_chf'),
    shop: col('where_to_buy', 'shop', 'store'), notes: col('notes'),
  };
  if (c.name < 0) return toast('The CSV needs a "name" column');
  const get = (r, i) => (i >= 0 ? (r[i] ?? '').trim() : undefined);
  const statusOf = (s) => {
    s = norm(s);
    return s.includes('buy') ? 'buy' : s.includes('borrow') ? 'borrow' : 'own';
  };
  let added = 0;
  let updated = 0;
  const changed = [];
  for (const r of rows.slice(1)) {
    const name = get(r, c.name);
    if (!name) continue;
    const brand = get(r, c.brand);
    const model = get(r, c.model);
    const existing = data.items.find(
      (i) =>
        norm(i.name) === norm(name) &&
        (brand === undefined || norm(i.brand) === norm(brand)) &&
        (model === undefined || norm(i.model) === norm(model)),
    );
    const it = existing ? { ...existing } : { id: uid(), name, brand: brand || '', model: model || '', category: 'Other', weight: 0, qty: 1, status: 'own', location: 'With me', carryOn: false, price: null, shop: '', notes: '', photo: null };
    const v = (i) => get(r, i);
    if (v(c.category)) it.category = v(c.category);
    if (v(c.weight)) it.weight = num(v(c.weight)) ?? it.weight;
    if (v(c.qty)) it.qty = Math.max(1, Math.round(num(v(c.qty)) ?? 1));
    if (v(c.status)) it.status = statusOf(v(c.status));
    if (v(c.location) !== undefined && v(c.location) !== '') it.location = v(c.location);
    if (v(c.carry)) it.carryOn = /^(y|yes|true|1|ja|x)$/i.test(v(c.carry));
    if (v(c.price) !== undefined && v(c.price) !== '') it.price = num(v(c.price));
    if (v(c.shop)) it.shop = v(c.shop);
    if (v(c.notes)) it.notes = v(c.notes);
    changed.push(it);
    if (existing) updated++;
    else added++;
  }
  if (changed.length) await save('items', ...changed);
  toast(`Imported: ${added} new, ${updated} updated`);
}

export async function exportListsCSV() {
  const rows = [['trip', 'start', 'end', 'bag', 'item', 'brand', 'model', 'category', 'quantity', 'weight_g', 'packed', 'plan']];
  for (const trip of sortedTrips()) {
    for (const t of tripItems(trip.id)) {
      const it = itemOf(t);
      rows.push([trip.name, trip.start, trip.end, bagOf(trip, t.bagId)?.name || '', it.name, it.brand || '', it.model || '', it.category, t.qty, (it.weight || 0) * t.qty, t.packed ? 'yes' : 'no', PLAN[t.plan]]);
    }
  }
  await saveFile(`packlist-packing-lists-${todayKey()}.csv`, BOM + toCSV(rows), 'text/csv');
}

// Columns chosen to be easy to import into a spending tracker.
export async function exportShopCSV() {
  const rows = [['date', 'item', 'brand', 'model', 'category', 'quantity', 'unit_price', 'total', 'currency', 'where_to_buy', 'needed_for', 'notes']];
  for (const i of data.items.filter((x) => x.status === 'buy').sort((a, b) => a.name.localeCompare(b.name))) {
    const total = i.price != null ? (Number(i.price) * (Number(i.qty) || 1)).toFixed(2) : '';
    const trips = [...new Set(tripsUsing(i.id).map((u) => u.trip.name))].join('; ');
    rows.push([todayKey(), i.name, i.brand || '', i.model || '', i.category, i.qty, i.price != null ? Number(i.price).toFixed(2) : '', total, 'CHF', i.shop, trips, i.notes]);
  }
  await saveFile(`packlist-shopping-${todayKey()}.csv`, BOM + toCSV(rows), 'text/csv');
}
