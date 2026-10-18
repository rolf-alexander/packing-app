// Gear inventory: the master list of everything you own, need to buy or are borrowing.
import { data, find } from '../store.js';
import { esc, fmtW, norm, plural } from '../util.js';
import { header, icon, refresh, empty } from '../ui.js';
import { STATUS, locations } from '../model.js';
import { itemSheet } from '../forms.js';

const g = { q: '', status: 'all', loc: 'all' };

export function gearRow(i, act = 'item', extra = '') {
  const badges = [];
  if (i.status !== 'own') badges.push(`<span class="badge ${i.status === 'buy' ? 'warn' : ''}">${STATUS[i.status]}</span>`);
  if (i.carryOn) badges.push(`<span class="badge info">${icon('zap')}Carry-on</span>`);
  const w = (Number(i.weight) || 0) * (Number(i.qty) || 1);
  return `<button class="row row-main gear-row" data-act="${act}" data-id="${i.id}">
    ${i.photo ? `<img class="thumb" src="${i.photo}" alt="">` : `<span class="thumb">${esc(i.name.slice(0, 1).toUpperCase())}</span>`}
    <span class="row-text">
      <span class="row-title">${esc(i.name)}${i.qty > 1 ? ` <span class="qty">×${i.qty}</span>` : ''}</span>
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
      (!q || norm([i.name, i.category, i.notes, i.location, i.shop].join(' ')).includes(q)),
  );
  if (!items.length) return empty(data.items.length ? 'No matching gear' : 'No gear yet', data.items.length ? 'Try a different search or filter.' : 'Tap + to add your first item.');
  const total = items.reduce((s, i) => s + (Number(i.weight) || 0) * (Number(i.qty) || 1), 0);
  const cats = [...new Set(items.map((i) => i.category || 'Other'))].sort();
  return `<p class="hint">${plural(items.length, 'item')} · ${fmtW(total)}</p>` +
    cats
      .map((c) => {
        const list = items.filter((i) => (i.category || 'Other') === c).sort((a, b) => a.name.localeCompare(b.name));
        return `<h3 class="group-h"><span>${esc(c)}</span><span class="gw">${list.length}</span></h3><div class="list">${list.map((i) => gearRow(i)).join('')}</div>`;
      })
      .join('');
}

export const gearView = {
  tab: 'gear',
  render() {
    const count = (s) => data.items.filter((i) => i.status === s).length;
    const statusChips = [['all', 'All'], ['own', 'Own'], ['buy', `To buy (${count('buy')})`], ['borrow', `Borrowing (${count('borrow')})`]]
      .map(([v, l]) => `<button class="chip ${g.status === v ? 'on' : ''}" data-act="status" data-v="${v}">${l}</button>`)
      .join('');
    const locChips = [['all', 'Anywhere'], ...locations().map((l) => [l, l])]
      .map(([v, l]) => `<button class="chip ${g.loc === v ? 'on' : ''}" data-act="loc" data-v="${esc(v)}">${v === 'all' ? '' : icon('pin')}${esc(l)}</button>`)
      .join('');
    return `${header({ title: 'Gear' })}
      <div class="page">
        <div class="searchbar">${icon('search')}<input type="search" id="gq" placeholder="Search gear" value="${esc(g.q)}" autocomplete="off"></div>
        <div class="chips scroll">${statusChips}</div>
        <div class="chips scroll">${locChips}</div>
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
  },
};
