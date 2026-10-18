// Gear inventory: the master list of everything you own, need to buy or are borrowing.
import { data, find } from '../store.js';
import { esc, fmtW, norm, plural } from '../util.js';
import { header, icon, refresh, empty } from '../ui.js';
import { STATUS, locations, makeModel } from '../model.js';
import { itemSheet } from '../forms.js';

// Filters and layout for the gear list (kept while the app is open).
const g = { q: '', status: 'all', loc: 'all', group: 'category', sort: 'name' };

const GROUPS = {
  category: { label: 'Category', key: (i) => i.category || 'Other' },
  brand: { label: 'Brand', key: (i) => i.brand || 'Generic (no brand)', last: 'Generic (no brand)' },
  location: { label: 'Where', key: (i) => i.location || 'Unknown location', last: 'Unknown location' },
  status: { label: 'Status', key: (i) => STATUS[i.status] || 'Own' },
};
const SORTS = {
  name: { label: 'A–Z', fn: (a, b) => a.name.localeCompare(b.name) || makeModel(a).localeCompare(makeModel(b)) },
  heavy: { label: 'Heaviest', fn: (a, b) => totalWeight(b) - totalWeight(a) },
};

const totalWeight = (i) => (Number(i.weight) || 0) * (Number(i.qty) || 1);

export function gearRow(i, act = 'item', extra = '') {
  const badges = [];
  if (i.status !== 'own') badges.push(`<span class="badge ${i.status === 'buy' ? 'warn' : ''}">${STATUS[i.status]}</span>`);
  if (i.carryOn) badges.push(`<span class="badge info">${icon('zap')}Carry-on</span>`);
  const w = totalWeight(i);
  const mm = makeModel(i);
  return `<button class="row row-main gear-row" data-act="${act}" data-id="${i.id}">
    ${i.photo ? `<img class="thumb" src="${i.photo}" alt="">` : `<span class="thumb">${esc((i.brand || i.name).slice(0, 1).toUpperCase())}</span>`}
    <span class="row-text">
      <span class="row-title">${esc(i.name)}${i.qty > 1 ? ` <span class="qty">×${i.qty}</span>` : ''}</span>
      ${mm ? `<span class="row-model">${esc(mm)}</span>` : ''}
      <span class="row-sub">${w ? `<span>${fmtW(w)}</span>` : ''}${i.location ? `<span>${icon('pin')}${esc(i.location)}</span>` : ''}${badges.join('')}</span>${extra}
    </span>
  </button>`;
}

function listHtml() {
  const q = norm(g.q).trim();
  const items = data.items.filter(
    (i) =>
      (g.status === 'all' || i.status === g.status) &&
      (g.loc === 'all' || i.location === g.loc) &&
      (!q || norm([i.name, i.brand, i.model, i.category, i.notes, i.location, i.shop].join(' ')).includes(q)),
  );
  if (!items.length) return empty(data.items.length ? 'No matching gear' : 'No gear yet', data.items.length ? 'Try a different search or filter.' : 'Tap + to add your first item.');
  const branded = items.filter((i) => i.brand || i.model).length;
  const grouping = GROUPS[g.group];
  const keys = [...new Set(items.map(grouping.key))].sort((a, b) => (a === grouping.last) - (b === grouping.last) || a.localeCompare(b));
  return `<p class="hint">${plural(items.length, 'item')} · ${fmtW(items.reduce((s, i) => s + totalWeight(i), 0))} · ${branded} with brand or model</p>` +
    keys
      .map((k) => {
        const list = items.filter((i) => grouping.key(i) === k).sort(SORTS[g.sort].fn);
        const w = list.reduce((s, i) => s + totalWeight(i), 0);
        return `<h3 class="group-h"><span>${esc(k)}</span><span class="gw">${list.length}${w ? ` · ${fmtW(w)}` : ''}</span></h3>
          <div class="list">${list.map((i) => gearRow(i)).join('')}</div>`;
      })
      .join('');
}

export const gearView = {
  tab: 'gear',
  render() {
    const count = (s) => data.items.filter((i) => i.status === s).length;
    const chip = (act, v, label, on) => `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-v="${esc(v)}">${label}</button>`;
    const statusChips = [['all', 'All'], ['own', 'Own'], ['buy', `To buy (${count('buy')})`], ['borrow', `Borrowing (${count('borrow')})`]]
      .map(([v, l]) => chip('status', v, l, g.status === v))
      .join('');
    const locChips = [['all', 'Anywhere'], ...locations().map((l) => [l, l])]
      .map(([v, l]) => chip('loc', v, `${v === 'all' ? '' : icon('pin')}${esc(l)}`, g.loc === v))
      .join('');
    const layoutChips =
      Object.entries(GROUPS).map(([v, o]) => chip('group', v, o.label, g.group === v)).join('') +
      '<span class="divider"></span>' +
      Object.entries(SORTS).map(([v, o]) => chip('sort', v, o.label, g.sort === v)).join('');
    return `${header({ title: 'Gear' })}
      <div class="page">
        <div class="searchbar">${icon('search')}<input type="search" id="gq" placeholder="Search name, brand, model…" value="${esc(g.q)}" autocomplete="off"></div>
        <div class="chips scroll">${statusChips}</div>
        <div class="chips scroll">${locChips}</div>
        <div class="chips scroll"><span class="chip-label">Group</span>${layoutChips}</div>
        <div id="gear-list">${listHtml()}</div>
      </div>
      <button class="fab" data-act="new" aria-label="Add gear">${icon('plus')}</button>`;
  },
  onInput(e) {
    if (e.target.id !== 'gq') return;
    g.q = e.target.value;
    document.getElementById('gear-list').innerHTML = listHtml();
  },
  act: {
    new: () => itemSheet(null, { defaults: g.status !== 'all' ? { status: g.status } : {} }),
    item: (el) => itemSheet(find('items', el.dataset.id)),
    status: (el) => {
      g.status = el.dataset.v;
      refresh();
    },
    loc: (el) => {
      g.loc = el.dataset.v;
      refresh();
    },
    group: (el) => {
      g.group = el.dataset.v;
      refresh();
    },
    sort: (el) => {
      g.sort = el.dataset.v;
      refresh();
    },
  },
};
