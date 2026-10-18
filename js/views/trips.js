// Trips list and the trip screen (Pack / Bags / Admin / Repack tabs).
import { data, find, save, remove } from '../store.js';
import { esc, fmtW, fmtRange, fmtDate, daysUntil, addDays, uid, plural, norm, num } from '../util.js';
import { header, icon, openSheet, toast, ask, refresh, progress, field, empty, shareOrCopy } from '../ui.js';
import * as M from '../model.js';
import { itemSheet, pickItems } from '../forms.js';

// Display preferences for the packing list (kept while the app is open).
const prefs = { group: 'bag', filter: 'all', repackTo: {} };

function countdown(trip) {
  if (!trip.start) return '';
  const d = daysUntil(trip.start);
  if (d > 1) return `in ${d} days`;
  if (d === 1) return 'tomorrow';
  if (d === 0) return 'today';
  if (!trip.end || daysUntil(trip.end) >= 0) return 'now';
  return 'finished';
}

// ---------------- Trips list ----------------
export const tripsView = {
  tab: 'trips',
  render() {
    const trips = M.sortedTrips();
    return `${header({ title: 'Trips' })}
      <div class="page">
        ${trips.length ? trips.map(tripCard).join('') : empty('No trips yet', 'Tap + to plan your first trip.')}
      </div>
      <button class="fab" data-act="new" aria-label="New trip">${icon('plus')}</button>`;
  },
  act: { new: () => tripSheet() },
};

function tripCard(t) {
  const s = M.tripStats(t);
  const tasks = data.tasks.filter((k) => k.tripId === t.id && !k.done);
  const overdue = tasks.filter((k) => k.due && daysUntil(k.due) < 0).length;
  const warn = [];
  if (s.overBags.length) warn.push(`${icon('alert')} Over the limit: ${s.overBags.map((b) => esc(b.bag.name)).join(', ')}`);
  if (s.carryIssues.length) warn.push(`${icon('zap')} ${plural(s.carryIssues.length, 'item')} must move to carry-on`);
  if (overdue) warn.push(`${icon('tasks')} ${plural(overdue, 'admin task')} overdue`);
  const cd = countdown(t);
  return `<a class="card trip-card ${cd === 'now' ? 'is-now' : ''} ${cd === 'finished' ? 'is-past' : ''}" href="#/trip/${t.id}">
    <div class="trip-head">
      <div><h2>${esc(t.name)}</h2><p class="muted">${t.destination ? `${esc(t.destination)} · ` : ''}${fmtRange(t.start, t.end)}</p></div>
      ${cd ? `<span class="pill ${cd === 'now' ? 'pill-accent' : ''}">${cd}</span>` : ''}
    </div>
    ${progress(s.done, s.total)}
    <p class="meta">${s.done}/${s.total} packed · ${fmtW(s.weight)} · ${plural(tasks.length, 'task')} to do</p>
    ${warn.map((w) => `<p class="warn-line">${w}</p>`).join('')}
  </a>`;
}

const defaultBags = () => [
  { id: uid(), name: 'Checked bag', kind: 'checked', limit: 23, tare: 3500 },
  { id: uid(), name: 'Carry-on', kind: 'cabin', limit: 8, tare: 2300 },
  { id: uid(), name: 'On me', kind: 'worn', limit: null, tare: 0 },
];

// Copies bags and packing list from one trip into a new (unsaved) trip object.
async function copyTripContents(from, to) {
  const bagMap = {};
  to.bags = from.bags.map((b) => {
    const nb = { ...b, id: uid() };
    bagMap[b.id] = nb.id;
    return nb;
  });
  await save('trips', to);
  const tis = M.tripItems(from.id).map((t) => ({ ...t, id: uid(), tripId: to.id, bagId: bagMap[t.bagId] || null, packed: false }));
  if (tis.length) await save('tripItems', ...tis);
}

function tripSheet(trip) {
  const isNew = !trip;
  const others = M.sortedTrips().filter((t) => t.id !== trip?.id);
  const body = `<form id="tf" class="form">
    ${field('Name', `<input name="name" value="${esc(trip?.name || '')}" placeholder="e.g. Japan">`)}
    ${field('Destination', `<input name="destination" value="${esc(trip?.destination || '')}" placeholder="e.g. Hokkaido">`)}
    <div class="grid2">
      ${field('Start', `<input type="date" name="start" value="${trip?.start || ''}">`)}
      ${field('End', `<input type="date" name="end" value="${trip?.end || ''}">`)}
    </div>
    ${isNew && others.length
      ? field('Start from', `<select name="copy"><option value="">Empty list with standard bags</option>${others.map((o) => `<option value="${o.id}">Copy of ${esc(o.name)}</option>`).join('')}</select>`, 'Copying brings over the bags and packing list, with nothing ticked.')
      : ''}
    ${field('Notes', `<textarea name="notes" rows="3">${esc(trip?.notes || '')}</textarea>`)}
  </form>`;
  const footer = isNew
    ? `<button class="btn primary block" data-act="save">Create trip</button>`
    : `<button class="btn danger" data-act="delete" aria-label="Delete trip">${icon('trash')}</button>
       <button class="btn" data-act="dup">${icon('copy')} Duplicate</button>
       <button class="btn primary grow" data-act="save">Save</button>`;

  openSheet({
    title: isNew ? 'New trip' : 'Edit trip',
    body,
    footer,
    onClick: async (act, el, e, s) => {
      if (act === 'save') {
        const f = new FormData(s.$('#tf'));
        const name = f.get('name').trim();
        if (!name) {
          s.$('[name=name]').focus();
          return toast('Give the trip a name');
        }
        const obj = trip ? { ...trip } : { id: uid(), bags: defaultBags() };
        Object.assign(obj, { name, destination: f.get('destination').trim(), start: f.get('start'), end: f.get('end'), notes: f.get('notes').trim() });
        if (obj.start && obj.end && obj.end < obj.start) return toast('The end date is before the start date');
        const source = isNew && f.get('copy') && find('trips', f.get('copy'));
        if (source) await copyTripContents(source, obj);
        else await save('trips', obj);
        s.close();
        if (isNew) location.hash = `#/trip/${obj.id}`;
        else refresh();
      }
      if (act === 'dup') {
        const copy = { ...trip, id: uid(), name: `${trip.name} (copy)` };
        await copyTripContents(trip, copy);
        s.close();
        toast('Trip duplicated');
        location.hash = `#/trip/${copy.id}`;
      }
      if (act === 'delete') {
        const ok = await ask(`Delete "${trip.name}" with its packing list and admin tasks? Your gear inventory is not affected.`, { title: 'Delete trip', ok: 'Delete', danger: true });
        if (!ok) return;
        await remove('tripItems', ...data.tripItems.filter((t) => t.tripId === trip.id).map((t) => t.id));
        await remove('tasks', ...data.tasks.filter((t) => t.tripId === trip.id).map((t) => t.id));
        await remove('trips', trip.id);
        s.close();
        toast('Trip deleted');
        location.hash = '#/trips';
      }
    },
  });
}

// ---------------- One trip ----------------
const TABS = [['pack', 'Pack'], ['bags', 'Bags'], ['admin', 'Admin'], ['repack', 'Repack']];

export const tripView = {
  tab: 'trips',
  render(id, tab = 'pack') {
    const trip = find('trips', id);
    if (!trip) return header({ title: 'Trip not found', back: '#/trips' }) + `<div class="page">${empty('This trip no longer exists')}</div>`;
    const openTasks = data.tasks.filter((k) => k.tripId === id && !k.done).length;
    const tabs = `<nav class="tabs">${TABS.map(([k, l]) => `<a href="#/trip/${id}/${k}" class="${k === tab ? 'on' : ''}">${l}${k === 'admin' && openTasks ? ` <span class="count">${openTasks}</span>` : ''}</a>`).join('')}</nav>`;
    const content = { pack: packTab, bags: bagsTab, admin: adminTab, repack: repackTab }[tab](trip);
    return `${header({
      title: trip.name,
      sub: `${trip.destination ? `${trip.destination} · ` : ''}${fmtRange(trip.start, trip.end)}`,
      back: '#/trips',
      right: `<button class="icon-btn" data-act="edit" aria-label="Edit trip">${icon('edit')}</button>`,
      extra: tabs,
    })}<div class="page">${content}</div>`;
  },
  onChange(e, id) {
    if (e.target.id === 'repack-to') {
      prefs.repackTo[id] = e.target.value;
      refresh();
    }
  },
  act: {
    edit: (el, e, id) => tripSheet(find('trips', id)),
    pref: (el) => {
      prefs[el.dataset.k] = el.dataset.v;
      refresh();
    },
    tick: async (el) => {
      const ti = find('tripItems', el.dataset.id);
      ti.packed = !ti.packed;
      await save('tripItems', ti);
      refresh();
    },
    assign: async (el) => {
      const ti = find('tripItems', el.dataset.id);
      ti.bagId = el.dataset.bag;
      await save('tripItems', ti);
      refresh();
    },
    ti: (el, e, id) => tiSheet(find('trips', id), find('tripItems', el.dataset.id)),
    add: (el, e, id) => addItemsSheet(find('trips', id)),
    tpl: (el, e, id) => templateSheet(find('trips', id)),
    share: (el, e, id) => shareSheet(find('trips', id)),
    'bag-edit': (el, e, id) => bagSheet(find('trips', id), el.dataset.id),
    'bag-new': (el, e, id) => bagSheet(find('trips', id), null),
    'task-tick': async (el) => {
      const k = find('tasks', el.dataset.id);
      k.done = !k.done;
      await save('tasks', k);
      refresh();
    },
    task: (el, e, id) => taskSheet(id, find('tasks', el.dataset.id)),
    'task-new': (el, e, id) => taskSheet(id, null),
    'task-std': (el, e, id) => standardTasksSheet(find('trips', id)),
    rp: async (el, e, id) => {
      const trip = find('trips', id);
      await repackItems(trip, repackTarget(trip), [find('tripItems', el.dataset.id)], el.dataset.plan);
      refresh();
    },
    'rp-all': async (el, e, id) => {
      const trip = find('trips', id);
      const target = repackTarget(trip);
      const have = new Set(M.tripItems(target.id).map((t) => t.itemId));
      const n = await repackItems(trip, target, M.tripItems(id).filter((t) => t.plan === 'pack' && !have.has(t.itemId)), 'pack');
      toast(`${plural(n, 'item')} added to ${target.name}`);
      refresh();
    },
    'rp-undo': async (el) => {
      await remove('tripItems', el.dataset.id);
      refresh();
    },
    'untick-all': async (el, e, id) => {
      const ticked = M.tripItems(id).filter((t) => t.packed);
      if (!ticked.length) return toast('Nothing is ticked');
      if (!(await ask(`Untick all ${ticked.length} packed items on this trip so you can repack?`, { title: 'Start repacking', ok: 'Untick all' }))) return;
      ticked.forEach((t) => (t.packed = false));
      await save('tripItems', ...ticked);
      toast('All unticked');
      refresh();
    },
  },
};

// ---------------- Pack tab ----------------
const chip = (k, v, label) => `<button class="chip ${prefs[k] === v ? 'on' : ''}" data-act="pref" data-k="${k}" data-v="${v}">${label}</button>`;

function tiRow(trip, ti, { chips = false } = {}) {
  const it = M.itemOf(ti);
  const bag = M.bagOf(trip, ti.bagId);
  const issue = M.carryIssue(trip, ti);
  const badges = [];
  if (it.carryOn) badges.push(`<span class="badge ${issue ? 'bad' : 'info'}">${icon('zap')}${issue ? 'Move to carry-on' : 'Carry-on'}</span>`);
  if (it.status === 'buy') badges.push(`<span class="badge warn">To buy</span>`);
  if (it.status === 'borrow') badges.push(`<span class="badge">Borrowed</span>`);
  if (it.location && norm(it.location) !== 'with me') badges.push(`<span class="badge">${icon('pin')}${esc(it.location)}</span>`);
  if (ti.plan !== 'pack') badges.push(`<span class="badge warn">${M.PLAN[ti.plan]}</span>`);
  if (prefs.group === 'cat' && bag && ti.plan === 'pack') badges.push(`<span class="badge">${esc(bag.name)}</span>`);
  const w = M.tiWeight(ti);
  return `<div class="row ${ti.packed ? 'done' : ''}">
    <button class="tick" data-act="tick" data-id="${ti.id}" aria-pressed="${ti.packed}" aria-label="Packed: ${esc(it.name)}">${icon('check')}</button>
    <button class="row-main" data-act="ti" data-id="${ti.id}">
      <span class="row-title">${esc(it.name)}${ti.qty > 1 ? ` <span class="qty">×${ti.qty}</span>` : ''}</span>
      ${w || badges.length ? `<span class="row-sub">${w ? `<span>${fmtW(w)}</span>` : ''}${badges.join('')}</span>` : ''}
    </button>
    ${chips && trip.bags.length ? `<div class="bag-chips">${trip.bags.map((b) => `<button class="chip sm" data-act="assign" data-id="${ti.id}" data-bag="${b.id}">${esc(b.name)}</button>`).join('')}</div>` : ''}
  </div>`;
}

function bagWeightLabel(trip, bag) {
  const st = M.bagStats(trip, bag);
  const cls = st.over ? 't-bad' : st.near ? 't-warn' : '';
  return `<span class="${cls}">${st.over ? icon('alert') : ''}${fmtW(st.weight)}${st.limit ? ` / ${bag.limit} kg` : ''}</span>`;
}

function packTab(trip) {
  const s = M.tripStats(trip);
  const all = M.tripItems(trip.id);
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  const warnings = [
    s.overBags.length ? `<p class="warn-line">${icon('alert')} Over the limit: ${s.overBags.map((b) => esc(b.bag.name)).join(', ')}</p>` : '',
    s.carryIssues.length ? `<p class="warn-line bad">${icon('zap')} ${plural(s.carryIssues.length, 'battery item')} in checked luggage. Move to carry-on</p>` : '',
  ].join('');
  const summary = `<div class="card">
    <div class="sum-row">
      <div><div class="big">${pct}%</div><p class="muted">${s.done} of ${s.total} done</p></div>
      <div class="right"><div class="big">${fmtW(s.weight)}</div><p class="muted">total incl. bags</p></div>
    </div>
    ${progress(s.done, s.total)}${warnings}
  </div>`;
  const toolbar = `<div class="toolbar">
    <button class="btn grow" data-act="add">${icon('plus')} Items</button>
    <button class="btn grow" data-act="tpl">${icon('layers')} Template</button>
    <button class="btn" data-act="share" aria-label="Share list">${icon('share')}</button>
  </div>`;
  if (!all.length) return summary + toolbar + empty('Nothing on this list yet', 'Add items from your gear, or start from a template like “Ski touring”.');

  const filters = `<div class="chips scroll">
    ${chip('filter', 'all', 'All')}${chip('filter', 'todo', 'To pack')}${chip('filter', 'done', 'Packed')}
    <span class="divider"></span>${chip('group', 'bag', 'By bag')}${chip('group', 'cat', 'By category')}
  </div>`;

  const show = (t) => prefs.filter === 'all' || (prefs.filter === 'todo' ? !t.packed : t.packed);
  const sortTi = (a, b) => {
    const ia = M.itemOf(a);
    const ib = M.itemOf(b);
    return (ia.category || '').localeCompare(ib.category || '') || ia.name.localeCompare(ib.name);
  };
  const active = all.filter((t) => t.plan === 'pack');
  const groups = [];
  if (prefs.group === 'bag') {
    const loose = active.filter((t) => !M.bagOf(trip, t.bagId));
    if (loose.length) groups.push({ title: 'No bag yet', items: loose, loose: true });
    for (const b of trip.bags) groups.push({ title: b.name, bag: b, items: active.filter((t) => t.bagId === b.id) });
  } else {
    const cats = [...new Set(active.map((t) => M.itemOf(t).category || 'Other'))].sort();
    for (const c of cats) groups.push({ title: c, items: active.filter((t) => (M.itemOf(t).category || 'Other') === c) });
  }
  const away = all.filter((t) => t.plan !== 'pack');
  if (away.length) groups.push({ title: 'Not coming (to-do)', items: away });

  const html = groups
    .map((g) => {
      const items = g.items.filter(show).sort(sortTi);
      if (!items.length && !(g.bag && prefs.filter === 'all')) return '';
      const packed = g.items.filter((t) => t.packed).length;
      const right = `${packed}/${g.items.length}${g.bag ? ` · ${bagWeightLabel(trip, g.bag)}` : ''}`;
      return `<h3 class="group-h"><span>${esc(g.title)}</span><span class="gw">${right}</span></h3>
        ${g.loose ? `<p class="hint">Tap a bag under each item to put it in.</p>` : ''}
        ${items.length ? `<div class="list">${items.map((t) => tiRow(trip, t, { chips: g.loose })).join('')}</div>` : `<p class="empty-sm">Nothing in this bag yet.</p>`}`;
    })
    .join('');

  return summary + toolbar + filters + (html || empty(prefs.filter === 'done' ? 'Nothing packed yet' : 'All packed!', ''));
}

function tiSheet(trip, ti) {
  const it = M.itemOf(ti);
  const body = () => `
    <p class="muted">${esc(it.category || '')}${it.weight ? ` · ${fmtW(it.weight)} each` : ''}${it.location ? ` · ${esc(it.location)}` : ''}</p>
    ${it.notes ? `<p class="note">${esc(it.notes)}</p>` : ''}
    <h3 class="label">Bag</h3>
    <div class="chips">${trip.bags.map((b) => `<button class="chip ${ti.bagId === b.id ? 'on' : ''}" data-act="bag" data-bag="${b.id}">${esc(b.name)}</button>`).join('')}
      <button class="chip ${!M.bagOf(trip, ti.bagId) ? 'on' : ''}" data-act="bag" data-bag="">No bag</button></div>
    ${M.carryIssue(trip, ti) ? `<p class="warn-line bad">${icon('zap')} Contains a lithium battery: put it in a carry-on bag.</p>` : ''}
    <h3 class="label">Quantity on this trip</h3>
    <div class="stepper"><button data-act="qty" data-d="-1" aria-label="Fewer">−</button><span>${ti.qty}</span><button data-act="qty" data-d="1" aria-label="More">+</button></div>
    <h3 class="label">Plan</h3>
    <div class="chips">${Object.entries(M.PLAN).map(([k, l]) => `<button class="chip ${ti.plan === k ? 'on' : ''}" data-act="plan" data-plan="${k}">${l}</button>`).join('')}</div>
    <label class="switch-row"><span><b>${ti.plan === 'pack' ? 'Packed' : 'Done'}</b></span><input type="checkbox" class="switch" data-act="packed" ${ti.packed ? 'checked' : ''}></label>`;

  openSheet({
    title: it.name,
    body: body(),
    footer: `<button class="btn danger" data-act="rm">Remove</button><button class="btn" data-act="gear">${icon('edit')} Gear</button><button class="btn primary grow" data-close>Done</button>`,
    onClick: async (act, el, e, s) => {
      if (act === 'bag') ti.bagId = el.dataset.bag || null;
      else if (act === 'qty') ti.qty = Math.max(1, ti.qty + Number(el.dataset.d));
      else if (act === 'plan') ti.plan = el.dataset.plan;
      else if (act === 'packed') ti.packed = el.checked;
      else if (act === 'gear') return itemSheet(it);
      else if (act === 'rm') {
        await remove('tripItems', ti.id);
        s.close();
        refresh();
        return toast(`Removed ${it.name}`, {
          action: 'Undo',
          onAction: async () => {
            await save('tripItems', ti);
            refresh();
          },
        });
      } else return;
      await save('tripItems', ti);
      s.setBody(body());
      refresh();
    },
  });
}

function addItemsSheet(trip) {
  const bagSelect = `<label class="field"><span class="flabel">Put new items in</span>
    <select id="add-bag"><option value="auto">Best guess (batteries to carry-on)</option>
    ${trip.bags.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}<option value="">No bag yet</option></select></label>`;
  pickItems({
    title: `Add to ${trip.name}`,
    locked: M.tripItems(trip.id).map((t) => t.itemId),
    top: bagSelect,
    onDone: async (ids, s) => {
      if (!ids.length) return toast('Tick the items you want to add');
      const n = await M.addToTrip(trip, ids, s.$('#add-bag').value);
      s.close();
      toast(`Added ${plural(n, 'item')}`);
      refresh();
    },
  });
}

function templateSheet(trip) {
  const have = new Set(M.tripItems(trip.id).map((t) => t.itemId));
  const rows = [...data.templates]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => {
      const ids = t.itemIds.filter((id) => find('items', id));
      const missing = ids.filter((id) => !have.has(id)).length;
      return `<div class="row"><div class="row-main static"><span class="row-title">${esc(t.name)}</span>
        <span class="row-sub">${plural(ids.length, 'item')}${ids.length - missing ? ` · ${ids.length - missing} already on list` : ''}</span></div>
        <button class="btn sm ${missing ? 'primary' : ''}" data-act="apply" data-id="${t.id}" ${missing ? '' : 'disabled'}>${missing ? `Add ${missing}` : 'Added'}</button></div>`;
    })
    .join('');
  openSheet({
    title: 'Add from a template',
    body: `<label class="field"><span class="flabel">Put new items in</span>
      <select id="tpl-bag"><option value="auto">Best guess (batteries to carry-on)</option>
      ${trip.bags.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}<option value="">No bag yet</option></select></label>
      ${rows ? `<div class="list">${rows}</div>` : empty('No templates yet')}
      <a class="btn block mt" href="#/templates" data-close>${icon('layers')} Manage templates</a>`,
    onClick: async (act, el, e, s) => {
      if (act !== 'apply') return;
      const tpl = find('templates', el.dataset.id);
      const n = await M.addToTrip(trip, tpl.itemIds, s.$('#tpl-bag').value);
      s.close();
      toast(`Added ${plural(n, 'item')} from ${tpl.name}`);
      refresh();
    },
  });
}

function shareText(trip, onlyTodo) {
  const s = M.tripStats(trip);
  const tis = M.tripItems(trip.id);
  const name = (t) => `${M.itemOf(t).name}${t.qty > 1 ? ` ×${t.qty}` : ''}`;
  const sorted = (list) => list.sort((a, b) => M.itemOf(a).name.localeCompare(M.itemOf(b).name));
  const lines = [
    `${trip.name}${trip.destination ? ` – ${trip.destination}` : ''}`,
    fmtRange(trip.start, trip.end),
    onlyTodo ? `Still to pack: ${tis.filter((t) => !t.packed && t.plan === 'pack').length} items` : `${s.done}/${s.total} packed · ${fmtW(s.weight)}`,
    '',
  ];
  const groups = [
    ...trip.bags.map((b) => [b, tis.filter((t) => t.plan === 'pack' && t.bagId === b.id)]),
    [null, tis.filter((t) => t.plan === 'pack' && !M.bagOf(trip, t.bagId))],
  ];
  for (const [bag, list] of groups) {
    const shown = sorted(list.filter((t) => !onlyTodo || !t.packed));
    if (!shown.length) continue;
    if (bag) {
      const st = M.bagStats(trip, bag);
      lines.push(`${bag.name.toUpperCase()} (${fmtW(st.weight)}${st.limit ? ` / ${bag.limit} kg` : ''})`);
    } else lines.push('NO BAG YET');
    shown.forEach((t) => lines.push(`${t.packed ? '☑' : '☐'} ${name(t)}`));
    lines.push('');
  }
  const away = sorted(tis.filter((t) => t.plan !== 'pack'));
  if (away.length && !onlyTodo) {
    lines.push('NOT COMING');
    away.forEach((t) => lines.push(`– ${name(t)} (${M.PLAN[t.plan].toLowerCase()})`));
  }
  return lines.join('\n').trim();
}

function shareSheet(trip) {
  let onlyTodo = false;
  const body = () => `<div class="chips">
      <button class="chip ${!onlyTodo ? 'on' : ''}" data-act="mode" data-v="0">Whole list</button>
      <button class="chip ${onlyTodo ? 'on' : ''}" data-act="mode" data-v="1">Only what's left</button></div>
    <textarea class="share-preview" readonly rows="14">${esc(shareText(trip, onlyTodo))}</textarea>`;
  openSheet({
    title: 'Share packing list',
    body: body(),
    footer: `<button class="btn grow" data-act="copy">${icon('copy')} Copy</button><button class="btn primary grow" data-act="send">${icon('share')} Share…</button>`,
    onClick: async (act, el, e, s) => {
      if (act === 'mode') {
        onlyTodo = el.dataset.v === '1';
        s.setBody(body());
      }
      const text = shareText(trip, onlyTodo);
      if (act === 'send') await shareOrCopy(text, `${trip.name} packing list`);
      if (act === 'copy') {
        try {
          await navigator.clipboard.writeText(text);
          toast('Copied');
        } catch {
          s.$('.share-preview').select();
          toast('Select the text and copy it');
        }
      }
    },
  });
}

// ---------------- Bags tab ----------------
function bagsTab(trip) {
  const s = M.tripStats(trip);
  const cards = s.bags
    .map(({ bag, count, packed, weight, limit, over, near }) => {
      const pct = limit ? Math.min(100, Math.round((weight / limit) * 100)) : 0;
      return `<button class="card bag-card" data-act="bag-edit" data-id="${bag.id}">
        <div class="trip-head"><div><h2>${esc(bag.name)}</h2><p class="muted">${M.BAG_KINDS[bag.kind] || ''}${bag.tare ? ` · empty bag ${fmtW(bag.tare)}` : ''}</p></div>${icon('edit', 'muted')}</div>
        <div class="weight-line ${over ? 't-bad' : near ? 't-warn' : ''}"><span class="big">${fmtW(weight)}</span>${limit ? `<span> / ${bag.limit} kg limit</span>` : '<span> · no limit</span>'}</div>
        ${limit ? `<div class="bar ${over ? 'over' : near ? 'near' : ''}"><span style="width:${pct}%"></span></div>` : ''}
        ${over ? `<p class="warn-line bad">${icon('alert')} ${fmtW(weight - limit)} over the limit</p>` : ''}
        <p class="meta">${plural(count, 'item')} · ${packed} packed</p>
      </button>`;
    })
    .join('');
  const issues = s.carryIssues.length
    ? `<h3 class="group-h"><span>${icon('zap')} Must go in carry-on</span></h3><div class="list">${s.carryIssues.map((t) => tiRow(trip, t)).join('')}</div>`
    : '';
  return `${issues}${cards || empty('No bags yet')}
    <button class="btn block" data-act="bag-new">${icon('plus')} Add a bag</button>
    <p class="hint center">Total for the whole trip: ${fmtW(s.weight)}</p>`;
}

function bagSheet(trip, bagId) {
  const bag = trip.bags.find((b) => b.id === bagId);
  const b = bag || { name: '', kind: 'checked', limit: 23, tare: 0 };
  openSheet({
    title: bag ? 'Edit bag' : 'New bag',
    body: `<form id="bf" class="form">
      ${field('Name', `<input name="name" value="${esc(b.name)}" placeholder="e.g. Ski bag">`)}
      ${field('Type', `<select name="kind">${Object.entries(M.BAG_KINDS).map(([k, l]) => `<option value="${k}" ${k === b.kind ? 'selected' : ''}>${l}</option>`).join('')}</select>`, 'Carry-on, personal item and “on me” count as cabin bags for battery rules.')}
      <div class="grid2">
        ${field('Weight limit (kg)', `<input name="limit" inputmode="decimal" value="${esc(b.limit ?? '')}" placeholder="none">`)}
        ${field('Empty bag weight (g)', `<input name="tare" inputmode="decimal" value="${esc(b.tare || '')}" placeholder="0">`)}
      </div>
      <p class="hint">Check your airline: typical limits are 23 kg checked and 7–10 kg carry-on.</p>
    </form>`,
    footer: `${bag ? `<button class="btn danger" data-act="del" aria-label="Delete bag">${icon('trash')}</button>` : ''}<button class="btn primary grow" data-act="save">Save</button>`,
    onClick: async (act, el, e, s) => {
      if (act === 'save') {
        const f = new FormData(s.$('#bf'));
        const name = f.get('name').trim();
        if (!name) return toast('Give the bag a name');
        const obj = { ...b, id: b.id || uid(), name, kind: f.get('kind'), limit: num(f.get('limit')), tare: num(f.get('tare')) || 0 };
        trip.bags = bag ? trip.bags.map((x) => (x.id === obj.id ? obj : x)) : [...trip.bags, obj];
        await save('trips', trip);
        s.close();
        refresh();
      }
      if (act === 'del') {
        const inBag = data.tripItems.filter((t) => t.tripId === trip.id && t.bagId === bag.id);
        if (!(await ask(`Delete "${bag.name}"?${inBag.length ? ` Its ${inBag.length} items stay on the list without a bag.` : ''}`, { title: 'Delete bag', ok: 'Delete', danger: true }))) return;
        inBag.forEach((t) => (t.bagId = null));
        if (inBag.length) await save('tripItems', ...inBag);
        trip.bags = trip.bags.filter((x) => x.id !== bag.id);
        await save('trips', trip);
        s.close();
        refresh();
      }
    },
  });
}

// ---------------- Admin tab ----------------
function dueLabel(task) {
  if (!task.due) return '';
  if (task.done) return `<span>${fmtDate(task.due)}</span>`;
  const d = daysUntil(task.due);
  if (d < 0) return `<span class="badge bad">Overdue · ${fmtDate(task.due)}</span>`;
  if (d === 0) return `<span class="badge warn">Due today</span>`;
  if (d <= 7) return `<span class="badge warn">Due in ${plural(d, 'day')}</span>`;
  return `<span>Due ${fmtDate(task.due, true)}</span>`;
}

function adminTab(trip) {
  const tasks = data.tasks
    .filter((k) => k.tripId === trip.id)
    .sort((a, b) => a.done - b.done || (a.due || '9999').localeCompare(b.due || '9999'));
  const done = tasks.filter((k) => k.done).length;
  const rows = tasks
    .map((k) => `<div class="row ${k.done ? 'done' : ''}">
      <button class="tick" data-act="task-tick" data-id="${k.id}" aria-pressed="${k.done}" aria-label="Done: ${esc(k.title)}">${icon('check')}</button>
      <button class="row-main" data-act="task" data-id="${k.id}"><span class="row-title">${esc(k.title)}</span>
      <span class="row-sub">${dueLabel(k)}${k.notes ? `<span class="clip">${esc(k.notes)}</span>` : ''}</span></button></div>`)
    .join('');
  return `<div class="card"><p class="muted">${done} of ${tasks.length} admin tasks done</p>${progress(done, tasks.length)}</div>
    <div class="toolbar"><button class="btn grow" data-act="task-new">${icon('plus')} Task</button><button class="btn grow" data-act="task-std">${icon('tasks')} Common tasks</button></div>
    ${rows ? `<div class="list">${rows}</div>` : empty('No admin tasks', 'Add passports, insurance, entry requirements, bookings and car hire, with due dates.')}`;
}

function taskSheet(tripId, task) {
  const k = task || { title: '', due: '', notes: '', done: false };
  openSheet({
    title: task ? 'Edit task' : 'New task',
    body: `<form id="kf" class="form">
      ${field('Task', `<input name="title" value="${esc(k.title)}" placeholder="e.g. Buy travel insurance">`)}
      ${field('Due date', `<input type="date" name="due" value="${k.due || ''}">`)}
      ${field('Notes', `<textarea name="notes" rows="3">${esc(k.notes || '')}</textarea>`)}
    </form>`,
    footer: `${task ? `<button class="btn danger" data-act="del" aria-label="Delete task">${icon('trash')}</button>` : ''}<button class="btn primary grow" data-act="save">Save</button>`,
    onClick: async (act, el, e, s) => {
      if (act === 'save') {
        const f = new FormData(s.$('#kf'));
        const title = f.get('title').trim();
        if (!title) return toast('Describe the task first');
        await save('tasks', { ...k, id: k.id || uid(), tripId, title, due: f.get('due'), notes: f.get('notes').trim() });
        s.close();
        refresh();
      }
      if (act === 'del') {
        await remove('tasks', task.id);
        s.close();
        refresh();
        toast('Task deleted', {
          action: 'Undo',
          onAction: async () => {
            await save('tasks', task);
            refresh();
          },
        });
      }
    },
  });
}

const COMMON_TASKS = [
  ['Passport valid for the whole trip', -45],
  ['Travel insurance bought (covers skiing if needed)', -30],
  ['Entry requirements / visa / eTA checked', -30],
  ['Flights or trains booked', -45],
  ['Accommodation booked', -30],
  ['Car hire booked', -21],
  ['Baggage allowance checked (incl. ski bag)', -14],
  ['Phone data / eSIM sorted', -7],
  ['Bank told about travel; cards work abroad', -7],
  ['Emergency contacts and insurance number saved offline', -3],
  ['Offline maps downloaded', -2],
  ['Online check-in done', -1],
];

function standardTasksSheet(trip) {
  const have = new Set(data.tasks.filter((k) => k.tripId === trip.id).map((k) => norm(k.title)));
  const options = COMMON_TASKS.filter(([t]) => !have.has(norm(t)));
  if (!options.length) return toast('All the common tasks are already on this trip');
  openSheet({
    title: 'Common tasks',
    body: `<p class="hint">Due dates are set before the trip starts. You can change them later.</p>
      <div class="list">${options.map(([t, off], i) => `<label class="pick"><input type="checkbox" value="${i}" checked><span class="pick-box">${icon('check')}</span>
        <span class="pick-main"><span>${esc(t)}</span>${trip.start ? `<small>Due ${fmtDate(addDays(trip.start, off), true)}</small>` : ''}</span></label>`).join('')}</div>`,
    footer: `<button class="btn primary block" data-act="add">Add selected</button>`,
    onClick: async (act, el, e, s) => {
      if (act !== 'add') return;
      const picked = s.$$('input:checked').map((i) => options[Number(i.value)]);
      if (!picked.length) return s.close();
      await save('tasks', ...picked.map(([title, off]) => ({ id: uid(), tripId: trip.id, title, due: trip.start ? addDays(trip.start, off) : '', notes: '', done: false })));
      s.close();
      toast(`Added ${plural(picked.length, 'task')}`);
      refresh();
    },
  });
}

// ---------------- Repack tab ----------------
function repackTarget(trip) {
  return find('trips', prefs.repackTo[trip.id]) || M.nextTripAfter(trip) || M.sortedTrips().find((t) => t.id !== trip.id);
}

async function repackItems(trip, target, tis, plan) {
  const have = new Set(data.tripItems.filter((t) => t.tripId === target.id).map((t) => t.itemId));
  const objs = tis
    .filter((t) => !have.has(t.itemId))
    .map((t) => {
      const fromBag = M.bagOf(trip, t.bagId);
      const same = fromBag && target.bags.find((b) => norm(b.name) === norm(fromBag.name));
      return {
        id: uid(),
        tripId: target.id,
        itemId: t.itemId,
        qty: t.qty,
        packed: false,
        plan,
        bagId: plan !== 'pack' ? null : same ? same.id : M.guessBag(target, M.itemOf(t)),
      };
    });
  if (objs.length) await save('tripItems', ...objs);
  return objs.length;
}

function repackTab(trip) {
  const target = repackTarget(trip);
  if (!target) return empty('No other trips', 'Repack mode helps you move from one trip to the next. Create another trip first.');
  const mine = M.tripItems(trip.id).filter((t) => t.plan === 'pack');
  const theirs = new Map(M.tripItems(target.id).map((t) => [t.itemId, t]));
  const pending = mine.filter((t) => !theirs.has(t.itemId));
  const decided = mine.filter((t) => theirs.has(t.itemId));
  const mineIds = new Set(mine.map((t) => t.itemId));
  const fresh = M.tripItems(target.id).filter((t) => !mineIds.has(t.itemId));
  const byName = (a, b) => M.itemOf(a).name.localeCompare(M.itemOf(b).name);

  const pendingRows = pending
    .sort(byName)
    .map((t) => `<div class="row rp-row"><div class="row-main static"><span class="row-title">${esc(M.itemOf(t).name)}</span>
      <span class="row-sub">${esc(M.bagOf(trip, t.bagId)?.name || 'No bag')}</span></div>
      <div class="rp-btns">
        <button class="chip sm" data-act="rp" data-plan="pack" data-id="${t.id}">Bring</button>
        <button class="chip sm" data-act="rp" data-plan="leave" data-id="${t.id}">Leave</button>
        <button class="chip sm" data-act="rp" data-plan="home" data-id="${t.id}">Send home</button>
      </div></div>`)
    .join('');
  const decidedRows = decided
    .sort(byName)
    .map((t) => {
      const other = theirs.get(t.itemId);
      return `<div class="row"><div class="row-main static"><span class="row-title">${esc(M.itemOf(t).name)}</span>
        <span class="row-sub"><span class="badge ${other.plan === 'pack' ? 'ok' : 'warn'}">${other.plan === 'pack' ? 'Bringing' : M.PLAN[other.plan]}</span></span></div>
        <button class="chip sm" data-act="rp-undo" data-id="${other.id}">Undo</button></div>`;
    })
    .join('');
  const freshRows = fresh
    .sort(byName)
    .map((t) => {
      const it = M.itemOf(t);
      const note = it.status === 'buy' ? 'Need to buy' : it.location && norm(it.location) !== 'with me' ? `Collect from ${it.location}` : it.status === 'borrow' ? 'Borrowing' : '';
      return `<div class="row"><div class="row-main static"><span class="row-title">${esc(it.name)}</span>${note ? `<span class="row-sub"><span class="badge warn">${esc(note)}</span></span>` : ''}</div></div>`;
    })
    .join('');

  return `<div class="card">
      <label class="field"><span class="flabel">Moving on from ${esc(trip.name)} to</span>
      <select id="repack-to">${M.sortedTrips().filter((t) => t.id !== trip.id).map((t) => `<option value="${t.id}" ${t.id === target.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
      <p class="hint">For each item on this trip, choose: <b>Bring</b> adds it to ${esc(target.name)}. <b>Leave</b> and <b>Send home</b> put it on ${esc(target.name)}'s list as a to-do.</p>
    </div>
    <h3 class="group-h"><span>To decide (${pending.length})</span>${pending.length ? `<button class="chip sm" data-act="rp-all">Bring all</button>` : ''}</h3>
    ${pendingRows ? `<div class="list">${pendingRows}</div>` : `<p class="empty-sm">Everything is decided.</p>`}
    ${decided.length ? `<details class="fold"><summary class="group-h"><span>Decided (${decided.length})</span></summary><div class="list">${decidedRows}</div></details>` : ''}
    ${fresh.length ? `<details class="fold" open><summary class="group-h"><span>New for ${esc(target.name)} (${fresh.length})</span></summary><div class="list">${freshRows}</div></details>` : ''}
    <div class="toolbar mt">
      <button class="btn grow" data-act="untick-all">${icon('refresh')} Untick this trip</button>
      <a class="btn primary grow" href="#/trip/${target.id}/pack">Open ${esc(target.name)}</a>
    </div>`;
}
