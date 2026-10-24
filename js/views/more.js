// More: search, backups and settings.
import { data, find, meta, replaceAll, setMeta } from '../store.js';
import { esc, norm, plural } from '../util.js';
import { header, icon, refresh, toast, ask, empty, applyTheme, segment } from '../ui.js';
import { tripsUsing } from '../model.js';
import { gearRow } from './gear.js';
import { exportJSON, importJSON, exportGearCSV, importGearCSV, exportListsCSV, exportShopCSV, exportServiceCSV } from '../backup.js';
import { seedStarter } from '../seed.js';

export const VERSION = '1.3.0';

// ---------------- More ----------------
const link = (href, ic, title, sub = '') =>
  `<a class="row row-main link-row" href="${href}">${icon(ic)}<span class="row-text"><span class="row-title">${title}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</span>${icon('chevron', 'muted')}</a>`;
const action = (act, ic, title, sub = '', cls = '') =>
  `<button class="row row-main link-row ${cls}" data-act="${act}">${icon(ic)}<span class="row-text"><span class="row-title">${title}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</span></button>`;

export const moreView = {
  tab: 'more',
  render() {
    const last = meta('lastBackup');
    const days = last ? Math.floor((Date.now() - new Date(last)) / 86400000) : null;
    const backupNote = last ? `Last backup ${days === 0 ? 'today' : `${plural(days, 'day')} ago`}` : 'No backup yet';
    let theme = 'auto';
    try {
      theme = localStorage.getItem('theme') || 'auto';
    } catch {}
    return `${header({ title: 'More' })}
      <div class="page">
        <div class="list">
          ${link('#/kits', 'layers', 'Kits', `${plural(data.templates.length, 'kit')} for tours and packing lists`)}
          ${link('#/search', 'search', 'Search everything')}
        </div>

        <h3 class="group-h"><span>Backup</span></h3>
        ${days == null || days > 14 ? `<p class="warn-line">${icon('alert')} ${backupNote}. Your data only lives on this phone, so save a backup now and then.</p>` : `<p class="hint">${backupNote}</p>`}
        <div class="list">
          ${action('exp-json', 'download', 'Save full backup (JSON)', 'Everything, including photos. Save it to Files or iCloud Drive')}
          ${action('imp-json', 'upload', 'Restore from backup', 'Replaces everything on this device')}
        </div>
        <h3 class="group-h"><span>Spreadsheets (CSV)</span></h3>
        <div class="list">
          ${action('exp-gear', 'download', 'Export gear list')}
          ${action('imp-gear', 'upload', 'Import gear list', 'Adds new items and updates ones with the same name')}
          ${action('exp-lists', 'download', 'Export all packing lists')}
          ${action('exp-shop', 'download', 'Export shopping list')}
          ${action('exp-service', 'download', 'Export service log')}
        </div>
        <input type="file" id="f-json" accept="application/json,.json" hidden>
        <input type="file" id="f-csv" accept=".csv,text/csv,text/plain" hidden>

        <h3 class="group-h"><span>Appearance</span></h3>
        ${segment('theme', [['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']], theme)}

        <h3 class="group-h"><span>Storage</span></h3>
        <p class="hint" id="storage-info">Stored only on this device. Works offline.</p>

        <h3 class="group-h"><span>Start over</span></h3>
        <div class="list">
          ${action('reseed', 'refresh', 'Reset to starter data', 'Deletes everything and reloads your starter gear, 3 kits and the pre-tour checklist', 'danger')}
          ${action('wipe', 'trash', 'Erase everything', 'Start with a completely empty app', 'danger')}
        </div>
        <p class="hint center">Packlist ${VERSION}</p>
      </div>`;
  },
  async mounted(root) {
    const info = root.querySelector('#storage-info');
    if (!navigator.storage?.estimate) return;
    const [est, persisted] = await Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.() ?? false]);
    const mb = ((est.usage || 0) / 1048576).toFixed(1);
    if (info.isConnected) info.textContent = `Stored only on this device (${mb} MB used${persisted ? ', protected from automatic clean-up' : ''}). Works offline.`;
  },
  async onChange(e) {
    if (e.target.name === 'theme') return applyTheme(e.target.value);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (e.target.id === 'f-json') await importJSON(file);
    if (e.target.id === 'f-csv') await importGearCSV(file);
    refresh();
  },
  act: {
    'exp-json': async () => {
      await exportJSON();
      refresh();
    },
    'imp-json': () => document.getElementById('f-json').click(),
    'exp-gear': () => exportGearCSV(),
    'imp-gear': () => document.getElementById('f-csv').click(),
    'exp-lists': () => exportListsCSV(),
    'exp-shop': () => exportShopCSV(),
    'exp-service': () => exportServiceCSV(),
    reseed: async () => {
      if (!(await ask('Delete all your gear, trips, tours, kits and lists, and reload the starter gear, kits and pre-tour checklist? Weights, photos, service logs and anything you added will be lost. Save a backup first if you want to keep anything.', { title: 'Reset to starter data', ok: 'Reset', danger: true }))) return;
      const keep = meta('lastBackup');
      await replaceAll({});
      if (keep) await setMeta('lastBackup', keep);
      await seedStarter();
      toast('Starter data loaded');
      location.hash = '#/gear';
      refresh();
    },
    wipe: async () => {
      if (!(await ask('Erase all gear, trips, tours, kits and checklists from this device? This cannot be undone.', { title: 'Erase everything', ok: 'Erase', danger: true }))) return;
      await replaceAll({ meta: { seeded: true } });
      toast('Everything erased');
      location.hash = '#/trips';
      refresh();
    },
  },
};

// ---------------- Search ----------------
let sq = '';

function results() {
  const q = norm(sq).trim();
  if (!q) return `<p class="empty-sm">Search across your gear, trips, packing lists, admin tasks, kits and the pre-tour check.</p>`;
  const has = (...v) => norm(v.join(' ')).includes(q);
  const items = data.items.filter((i) => has(i.name, i.brand, i.model, i.category, i.notes, i.location, i.shop)).sort((a, b) => a.name.localeCompare(b.name));
  const trips = data.trips.filter((t) => has(t.name, t.destination, t.notes, ...t.bags.map((b) => b.name)));
  const tasks = data.tasks.filter((k) => has(k.title, k.notes));
  const tpls = data.templates.filter((t) => has(t.name));
  const checks = data.checks.filter((c) => has(c.text));
  const section = (title, rows) => (rows.length ? `<h3 class="group-h"><span>${title}</span><span class="gw">${rows.length}</span></h3><div class="list">${rows.join('')}</div>` : '');
  const html = [
    section('Gear', items.slice(0, 50).map((i) => {
      const on = [...new Set(tripsUsing(i.id).map((u) => u.trip.name))];
      return gearRow(i, 'item', on.length ? `<span class="row-sub">On: ${esc(on.join(', '))}</span>` : '');
    })),
    section('Trips', trips.map((t) => link(`#/trip/${t.id}`, 'map', esc(t.name), esc(t.destination || '')))),
    section('Admin tasks', tasks.map((k) => link(`#/trip/${k.tripId}/admin`, 'tasks', esc(k.title), esc(find('trips', k.tripId)?.name || '')))),
    section('Kits', tpls.map((t) => link(`#/kit/${t.id}`, 'layers', esc(t.name)))),
    section('Pre-tour check', checks.map((c) => link('#/check', 'shield', esc(c.text)))),
  ].join('');
  return html || empty('Nothing found', `No matches for “${esc(sq)}”.`);
}

export const searchView = {
  tab: null,
  render() {
    return `${header({ title: 'Search', back: 'history' })}
      <div class="page">
        <div class="searchbar">${icon('search')}<input type="search" id="sq" placeholder="Search everything" value="${esc(sq)}" autocomplete="off" enterkeyhint="search"></div>
        <div id="sres">${results()}</div>
      </div>`;
  },
  mounted(root) {
    const input = root.querySelector('#sq');
    if (document.activeElement?.id !== 'sq') input.focus();
  },
  onInput(e) {
    if (e.target.id !== 'sq') return;
    sq = e.target.value;
    document.getElementById('sres').innerHTML = results();
  },
  act: { item: (el) => (location.hash = `#/item/${el.dataset.id}`) },
};
