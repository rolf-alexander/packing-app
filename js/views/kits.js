// Kits: reusable named sets of gear. They fill a trip's packing list or start a tour day.
// (Stored as "templates", the name they had before tours existed.)
import { data, find, save, remove } from '../store.js';
import { esc, fmtW, plural, uid } from '../util.js';
import { header, icon, refresh, ask, promptText, empty } from '../ui.js';
import { hasWeight, neverUsed } from '../model.js';
import { pickItems } from '../forms.js';
import { startTourSheet } from './tours.js';

const weightOf = (items) => items.reduce((s, i) => s + (Number(i.weight) || 0) * (Number(i.qty) || 1), 0);
const weightText = (items) => {
  const missing = items.filter((i) => !hasWeight(i)).length;
  return `${fmtW(weightOf(items))}${missing ? ` (${missing} without weight)` : ''}`;
};
const kitItems = (kit) => kit.itemIds.map((id) => find('items', id)).filter(Boolean);

export const kitsView = {
  tab: 'tours',
  render() {
    const rows = [...data.templates]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => {
        const items = kitItems(t);
        return `<a class="row row-main link-row" href="#/kit/${t.id}">${icon('layers')}<span class="row-text"><span class="row-title">${esc(t.name)}</span>
          <span class="row-sub">${plural(items.length, 'item')} · ${weightText(items)}</span></span>${icon('chevron', 'muted')}</a>`;
      })
      .join('');
    return `${header({ title: 'Kits', back: 'history' })}
      <div class="page">
        <p class="hint">Kits are reusable sets of gear. Start a tour day from one, or on a trip's Pack tab tap <b>Kit</b> to add a whole set in one go.</p>
        ${rows ? `<div class="list">${rows}</div>` : empty('No kits yet', 'Tap + to create one, e.g. “Day tour”.')}
      </div>
      <button class="fab" data-act="new" aria-label="New kit">${icon('plus')}</button>`;
  },
  act: {
    new: async () => {
      const name = await promptText({ title: 'New kit', label: 'Name', placeholder: 'e.g. Hut trip', ok: 'Create' });
      if (!name) return;
      const t = await save('templates', { id: uid(), name, itemIds: [] });
      location.hash = `#/kit/${t.id}`;
    },
  },
};

function unusedHtml(kit) {
  const tours = data.tours.filter((t) => t.kitId === kit.id && t.status === 'done').length;
  if (!tours) return '';
  const list = neverUsed(kit.id).sort((a, b) => b.carried - a.carried);
  const rows = list
    .map(({ item, carried }) => `<a class="row row-main link-row" href="#/item/${item.id}"><span class="row-text"><span class="row-title">${esc(item.name)}</span>
      <span class="row-sub"><span class="badge warn">Carried ${carried}×, never used</span>${hasWeight(item) ? `<span>${fmtW(item.weight * (item.qty || 1))}</span>` : ''}</span></span></a>`)
    .join('');
  return `<h3 class="group-h"><span>Carried 3+ times, never used</span><span class="gw">${plural(tours, 'finished tour')}</span></h3>
    ${rows ? `<div class="list">${rows}</div><p class="hint">Worth leaving at home next time?</p>` : `<p class="empty-sm">Nothing yet. Everything you carried 3 or more times got used.</p>`}`;
}

export const kitView = {
  tab: 'tours',
  render(id) {
    const t = find('templates', id);
    if (!t) return header({ title: 'Kit not found', back: '#/kits' }) + `<div class="page">${empty('This kit no longer exists')}</div>`;
    const items = kitItems(t);
    const cats = [...new Set(items.map((i) => i.category || 'Other'))].sort();
    const groups = cats
      .map((c) => `<h3 class="group-h"><span>${esc(c)}</span></h3><div class="list">${items
        .filter((i) => (i.category || 'Other') === c)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((i) => `<div class="row"><div class="row-main static"><span class="row-title">${esc(i.name)}</span><span class="row-sub">${hasWeight(i) ? fmtW(i.weight * (i.qty || 1)) : '<span class="badge">No weight</span>'}</span></div>
          <button class="icon-btn" data-act="rm" data-id="${i.id}" aria-label="Remove ${esc(i.name)}">${icon('x')}</button></div>`)
        .join('')}</div>`)
      .join('');
    return `${header({ title: t.name, sub: `${plural(items.length, 'item')} · ${weightText(items)}`, back: 'history' })}
      <div class="page">
        <button class="btn primary block" data-act="tour" ${items.length ? '' : 'disabled'}>${icon('shield')} Start a tour with this kit</button>
        <div class="toolbar mt">
          <button class="btn grow" data-act="pick">${icon('edit')} Choose items</button>
          <button class="btn" data-act="rename">Rename</button>
          <button class="btn danger" data-act="del" aria-label="Delete kit">${icon('trash')}</button>
        </div>
        ${unusedHtml(t)}
        ${groups || empty('This kit is empty', 'Tap “Choose items” to pick gear for it.')}
      </div>`;
  },
  act: {
    tour: (el, e, id) => startTourSheet(id),
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
      const name = await promptText({ title: 'Rename kit', label: 'Name', value: t.name });
      if (!name) return;
      t.name = name;
      await save('templates', t);
      refresh();
    },
    del: async (el, e, id) => {
      const t = find('templates', id);
      if (!(await ask(`Delete the kit "${t.name}"? Your gear, trips and past tours are not affected.`, { title: 'Delete kit', ok: 'Delete', danger: true }))) return;
      await remove('templates', id);
      location.replace('#/kits');
    },
  },
};
