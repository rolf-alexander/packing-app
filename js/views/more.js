// More: templates, search, backups and settings.
import { data, find, save, remove, meta, replaceAll, setMeta } from '../store.js';
import { esc, fmtW, norm, plural, uid } from '../util.js';
import { header, icon, refresh, toast, ask, promptText, empty, applyTheme, segment } from '../ui.js';
import { tripsUsing } from '../model.js';
import { itemSheet, pickItems } from '../forms.js';
import { gearRow } from './gear.js';
import { exportJSON, importJSON, exportGearCSV, importGearCSV, exportListsCSV, exportShopCSV } from '../backup.js';
import { seedStarter } from '../seed.js';

export const VERSION = '1.0.0';

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
          ${link('#/templates', 'layers', 'Templates', `${plural(data.templates.length, 'template')} for building packing lists`)}
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
        </div>
        <input type="file" id="f-json" accept="application/json,.json" hidden>
        <input type="file" id="f-csv" accept=".csv,text/csv,text/plain" hidden>

        <h3 class="group-h"><span>Appearance</span></h3>
        ${segment('theme', [['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']], theme)}

        <h3 class="group-h"><span>Storage</span></h3>
        <p class="hint" id="storage-info">Stored only on this device. Works offline.</p>

        <h3 class="group-h"><span>Start over</span></h3>
        <div class="list">
          ${action('reseed', 'refresh', 'Reset to starter data', 'Deletes everything and reloads the example gear and trips', 'danger')}
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
    reseed: async () => {
      if (!(await ask('Delete all your gear, trips and lists, and reload the starter data? Save a backup first if you want to keep anything.', { title: 'Reset to starter data', ok: 'Reset', danger: true }))) return;
      const keep = meta('lastBackup');
      await replaceAll({});
      if (keep) await setMeta('lastBackup', keep);
      await seedStarter();
      toast('Starter data loaded');
      location.hash = '#/trips';
      refresh();
    },
    wipe: async () => {
      if (!(await ask('Erase all gear, trips, templates and checklists from this device? This cannot be undone.', { title: 'Erase everything', ok: 'Erase', danger: true }))) return;
      await replaceAll({ meta: { seeded: true } });
      toast('Everything erased');
      location.hash = '#/trips';
      refresh();
    },
  },
};

// ---------------- Templates ----------------
export const templatesView = {
  tab: 'more',
  render() {
    const list = [...data.templates].sort((a, b) => a.name.localeCompare(b.name));
    const rows = list
      .map((t) => {
        const items = t.itemIds.map((id) => find('items', id)).filter(Boolean);
        const w = items.reduce((s, i) => s + (Number(i.weight) || 0) * (Number(i.qty) || 1), 0);
        return link(`#/template/${t.id}`, 'layers', esc(t.name), `${plural(items.length, 'item')} · ${fmtW(w)}`);
      })
      .join('');
    return `${header({ title: 'Templates', back: '#/more' })}
      <div class="page">
        <p class="hint">Templates are reusable sets of gear. On a trip's Pack tab, tap <b>Template</b> to add a whole set in one go.</p>
        ${rows ? `<div class="list">${rows}</div>` : empty('No templates yet', 'Tap + to create one.')}
      </div>
      <button class="fab" data-act="new" aria-label="New template">${icon('plus')}</button>`;
  },
  act: {
    new: async () => {
      const name = await promptText({ title: 'New template', label: 'Name', placeholder: 'e.g. Hut trip', ok: 'Create' });
      if (!name) return;
      const t = await save('templates', { id: uid(), name, itemIds: [] });
      location.hash = `#/template/${t.id}`;
    },
  },
};

export const templateView = {
  tab: 'more',
  render(id) {
    const t = find('templates', id);
    if (!t) return header({ title: 'Template not found', back: '#/templates' }) + `<div class="page">${empty('This template no longer exists')}</div>`;
    const items = t.itemIds.map((i) => find('items', i)).filter(Boolean);
    const cats = [...new Set(items.map((i) => i.category || 'Other'))].sort();
    const w = items.reduce((s, i) => s + (Number(i.weight) || 0) * (Number(i.qty) || 1), 0);
    const groups = cats
      .map((c) => `<h3 class="group-h"><span>${esc(c)}</span></h3><div class="list">${items
        .filter((i) => (i.category || 'Other') === c)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((i) => `<div class="row"><div class="row-main static"><span class="row-title">${esc(i.name)}</span>${i.weight ? `<span class="row-sub">${fmtW(i.weight * (i.qty || 1))}</span>` : ''}</div>
          <button class="icon-btn" data-act="rm" data-id="${i.id}" aria-label="Remove ${esc(i.name)}">${icon('x')}</button></div>`)
        .join('')}</div>`)
      .join('');
    return `${header({ title: t.name, sub: `${plural(items.length, 'item')} · ${fmtW(w)}`, back: '#/templates' })}
      <div class="page">
        <div class="toolbar">
          <button class="btn primary grow" data-act="pick">${icon('edit')} Choose items</button>
          <button class="btn" data-act="rename">Rename</button>
          <button class="btn danger" data-act="del" aria-label="Delete template">${icon('trash')}</button>
        </div>
        ${groups || empty('This template is empty', 'Tap “Choose items” to pick gear for it.')}
      </div>`;
  },
  act: {
    pick: (el, e, id) => {
      const t = find('templates', id);
      pickItems({
        title: t.name,
        chosen: t.itemIds,
        button: (n) => `Save (${plural(n, 'item')})`,
        onDone: async (ids, s) => {
          t.itemIds = ids;
          await save('templates', t);
          s.close();
          refresh();
        },
      });
    },
    rm: async (el, e, id) => {
      const t = find('templates', id);
      t.itemIds = t.itemIds.filter((x) => x !== el.dataset.id);
      await save('templates', t);
      refresh();
    },
    rename: async (el, e, id) => {
      const t = find('templates', id);
      const name = await promptText({ title: 'Rename template', label: 'Name', value: t.name });
      if (!name) return;
      t.name = name;
      await save('templates', t);
      refresh();
    },
    del: async (el, e, id) => {
      const t = find('templates', id);
      if (!(await ask(`Delete the template "${t.name}"? Your gear and trips are not affected.`, { title: 'Delete template', ok: 'Delete', danger: true }))) return;
      await remove('templates', id);
      location.hash = '#/templates';
    },
  },
};

// ---------------- Search ----------------
let sq = '';

function results() {
  const q = norm(sq).trim();
  if (!q) return `<p class="empty-sm">Search across your gear, trips, packing lists, admin tasks, templates and the pre-tour check.</p>`;
  const has = (...v) => norm(v.join(' ')).includes(q);
  const items = data.items.filter((i) => has(i.name, i.category, i.notes, i.location, i.shop)).sort((a, b) => a.name.localeCompare(b.name));
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
    section('Templates', tpls.map((t) => link(`#/template/${t.id}`, 'layers', esc(t.name)))),
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
  act: { item: (el) => itemSheet(find('items', el.dataset.id)) },
};
