// Tour days: start a checklist from a kit (plus condition tags), pack, then note what you didn't use.
import { data, find, save, remove, meta, setMeta } from '../store.js';
import { esc, fmtW, fmtDate, todayKey, uid, plural } from '../util.js';
import { header, icon, openSheet, toast, ask, refresh, promptText, progress, field, empty } from '../ui.js';
import { makeModel, tourTags, sortedTours, startTour } from '../model.js';
import { pickItems } from '../forms.js';

const entryWeight = (e) => {
  const it = find('items', e.itemId);
  return (Number(it?.weight) || 0) * (Number(it?.qty) || 1);
};
const liveEntries = (tour) => tour.entries.filter((e) => find('items', e.itemId));
const tourSub = (t) => [fmtDate(t.date, true), ...t.tags].join(' · ');

// How far through today's pre-tour check you are (the check resets daily).
function preTourDone() {
  const s = meta('pretour');
  const done = s && s.date === todayKey() ? s.done.filter((id) => find('checks', id)).length : 0;
  return { done, total: data.checks.length };
}

// ---------------- Tours tab ----------------
export const toursView = {
  tab: 'tours',
  render() {
    const tours = sortedTours();
    const open = tours.filter((t) => t.status !== 'done');
    const past = tours.filter((t) => t.status === 'done');
    const pt = preTourDone();
    const card = (t) => {
      const es = liveEntries(t);
      const packed = es.filter((e) => e.packed).length;
      const line = t.status === 'review' ? `<p class="warn-line">${icon('edit')} Tick what you didn't use, then save</p>` : progress(packed, es.length);
      return `<a class="card trip-card" href="#/tour/${t.id}">
        <div class="trip-head"><div><h2>${esc(t.kitName)}</h2><p class="muted">${esc(tourSub(t))}</p></div>
        <span class="pill ${t.date === todayKey() ? 'pill-accent' : ''}">${t.date === todayKey() ? 'today' : t.status === 'review' ? 'finishing' : 'packing'}</span></div>
        ${line}<p class="meta">${packed}/${es.length} packed · ${fmtW(es.filter((e) => e.packed).reduce((s, e) => s + entryWeight(e), 0))}</p></a>`;
    };
    const pastRows = past
      .slice(0, 30)
      .map((t) => {
        const carried = liveEntries(t).filter((e) => e.packed);
        const unused = carried.filter((e) => e.unused).length;
        return `<a class="row row-main link-row" href="#/tour/${t.id}">${icon('shield')}<span class="row-text"><span class="row-title">${esc(t.kitName)}</span>
          <span class="row-sub"><span>${esc(tourSub(t))}</span><span>${plural(carried.length, 'item')} carried${unused ? ` · ${unused} unused` : ''}</span></span></span>${icon('chevron', 'muted')}</a>`;
      })
      .join('');
    return `${header({ title: 'Tours' })}
      <div class="page">
        <div class="list">
          <a class="row row-main link-row" href="#/check">${icon('shield')}<span class="row-text"><span class="row-title">Pre-tour check</span>
            <span class="row-sub">${pt.done === pt.total && pt.total ? '<span class="badge ok">All checked today</span>' : `${pt.done} of ${pt.total} checked today`}</span></span>${icon('chevron', 'muted')}</a>
        </div>
        <button class="btn primary block mt" data-act="start">${icon('plus')} Start a tour</button>
        ${open.length ? `<h3 class="group-h"><span>In progress</span></h3>${open.map(card).join('')}` : ''}
        <h3 class="group-h"><span>Recent tours</span>${past.length ? `<span class="gw">${past.length}</span>` : ''}</h3>
        ${pastRows ? `<div class="list">${pastRows}</div>` : `<p class="empty-sm">Finished tours appear here.</p>`}
        <div class="list mt">
          <a class="row row-main link-row" href="#/kits">${icon('layers')}<span class="row-text"><span class="row-title">Kits</span><span class="row-sub">${plural(data.templates.length, 'kit')}</span></span>${icon('chevron', 'muted')}</a>
          <a class="row row-main link-row" href="#/tags">${icon('pin')}<span class="row-text"><span class="row-title">Condition tags</span><span class="row-sub">${esc(tourTags().map((t) => t.name).join(', ') || 'None')}</span></span>${icon('chevron', 'muted')}</a>
        </div>
      </div>`;
  },
  act: { start: () => startTourSheet() },
};

// Pick a kit, a date and condition tags, then create the tour.
export function startTourSheet(kitId) {
  const kits = [...data.templates].sort((a, b) => a.name.localeCompare(b.name));
  if (!kits.length) {
    toast('Create a kit first');
    location.hash = '#/kits';
    return;
  }
  const chosen = new Set();
  const tags = tourTags();
  const extra = (t) => t.itemIds.filter((id) => find('items', id)).length;
  const tagChips = () =>
    tags.map((t) => `<button type="button" class="chip ${chosen.has(t.id) ? 'on' : ''}" data-act="tag" data-id="${t.id}">${esc(t.name)}${extra(t) ? ` +${extra(t)}` : ''}</button>`).join('');
  openSheet({
    title: 'Start a tour',
    body: `<form id="stf" class="form">
      ${field('Kit', `<select name="kit">${kits.map((k) => `<option value="${k.id}" ${k.id === kitId ? 'selected' : ''}>${esc(k.name)} (${plural(k.itemIds.length, 'item')})</option>`).join('')}</select>`)}
      ${field('Date', `<input type="date" name="date" value="${todayKey()}">`)}
      ${field('Conditions', `<div class="chips" id="st-tags">${tagChips()}</div>`, 'Each tag adds the extra items linked to it. Change them under Tours → Condition tags.')}
    </form>`,
    footer: `<button class="btn primary block" data-act="go">Start</button>`,
    onClick: async (act, el, e, s) => {
      if (act === 'tag') {
        const id = el.dataset.id;
        if (chosen.has(id)) chosen.delete(id);
        else chosen.add(id);
        s.$('#st-tags').innerHTML = tagChips();
      }
      if (act === 'go') {
        const f = new FormData(s.$('#stf'));
        const tour = await startTour(find('templates', f.get('kit')), [...chosen], f.get('date') || todayKey());
        s.close();
        location.hash = `#/tour/${tour.id}`;
      }
    },
  });
}

// ---------------- One tour ----------------
function entryRow(tour, e, mode) {
  const it = find('items', e.itemId);
  const mm = makeModel(it);
  const w = entryWeight(e);
  const sub = [w ? `<span>${fmtW(w)}</span>` : '', e.tag ? `<span class="badge info">${esc(e.tag)}</span>` : ''].join('');
  const text = `<span class="row-title">${esc(it.name)}${it.qty > 1 ? ` <span class="qty">×${it.qty}</span>` : ''}</span>${mm ? `<span class="row-model">${esc(mm)}</span>` : ''}${sub ? `<span class="row-sub">${sub}</span>` : ''}`;
  if (mode === 'pack') {
    return `<div class="row ${e.packed ? 'done' : ''}">
      <button class="tick" data-act="tick" data-id="${e.itemId}" aria-pressed="${e.packed}" aria-label="Packed: ${esc(it.name)}">${icon('check')}</button>
      <button class="row-main" data-act="tick" data-id="${e.itemId}">${text}</button>
      <button class="icon-btn" data-act="rm" data-id="${e.itemId}" aria-label="Remove ${esc(it.name)}">${icon('x')}</button></div>`;
  }
  // Review: the tick means "didn't use".
  return `<div class="row ${e.unused ? 'done' : ''}">
    <button class="tick" data-act="unused" data-id="${e.itemId}" aria-pressed="${e.unused}" aria-label="Didn't use: ${esc(it.name)}">${icon('check')}</button>
    <button class="row-main" data-act="unused" data-id="${e.itemId}">${text}</button></div>`;
}

function packHtml(tour) {
  const es = liveEntries(tour);
  const packed = es.filter((e) => e.packed);
  const groups = [[null, 'Kit'], ...tour.tags.map((t) => [t, `For: ${t}`])];
  const lists = groups
    .map(([tag, title]) => {
      const rows = es.filter((e) => (e.tag || null) === tag);
      return rows.length ? `<h3 class="group-h"><span>${esc(title)}</span><span class="gw">${rows.filter((e) => e.packed).length}/${rows.length}</span></h3><div class="list">${rows.map((e) => entryRow(tour, e, 'pack')).join('')}</div>` : '';
    })
    .join('');
  return `<div class="card">
      <div class="sum-row"><div><div class="big">${packed.length}/${es.length}</div><p class="muted">packed</p></div>
      <div class="right"><div class="big">${fmtW(packed.reduce((s, e) => s + entryWeight(e), 0))}</div><p class="muted">packed weight</p></div></div>
      ${progress(packed.length, es.length)}
    </div>
    <div class="toolbar">
      <button class="btn grow" data-act="add">${icon('plus')} Items</button>
      <a class="btn grow" href="#/check">${icon('shield')} Pre-tour check</a>
    </div>
    ${lists || empty('Nothing on this list', 'Tap Items to add some.')}
    <button class="btn primary block mt" data-act="finish" ${es.length ? '' : 'disabled'}>${icon('check')} Finish tour</button>`;
}

function reviewHtml(tour) {
  const es = liveEntries(tour);
  const carried = es.filter((e) => e.packed);
  const left = es.filter((e) => !e.packed);
  const unused = carried.filter((e) => e.unused).length;
  const done = tour.status === 'done';
  return `<div class="card"><p class="muted">${done ? 'Finished.' : 'Tour finished.'} Tick everything you carried but <b>didn't use</b>. After a few tours, each kit shows what you keep carrying for nothing.</p>
      <p class="meta">${plural(carried.length, 'item')} carried · ${unused} not used</p></div>
    ${carried.length ? `<h3 class="group-h"><span>Didn't use</span></h3><div class="list">${carried.map((e) => entryRow(tour, e, 'review')).join('')}</div>` : `<p class="empty-sm">Nothing was ticked as packed.</p>`}
    ${left.length ? `<h3 class="group-h"><span>Not taken</span><span class="gw">${left.length}</span></h3><p class="hint">${esc(left.map((e) => find('items', e.itemId).name).join(', '))}</p>` : ''}
    ${done ? `<button class="btn block mt" data-act="reopen">${icon('refresh')} Back to the packing list</button>` : `<button class="btn primary block mt" data-act="save">${icon('check')} Save tour</button>`}`;
}

export const tourView = {
  tab: 'tours',
  render(id) {
    const tour = find('tours', id);
    if (!tour) return header({ title: 'Tour not found', back: '#/tours' }) + `<div class="page">${empty('This tour no longer exists')}</div>`;
    return `${header({
      title: tour.kitName,
      sub: tourSub(tour),
      back: '#/tours',
      right: `<button class="icon-btn" data-act="del" aria-label="Delete tour">${icon('trash')}</button>`,
    })}<div class="page">${tour.status === 'packing' ? packHtml(tour) : reviewHtml(tour)}</div>`;
  },
  act: {
    tick: (el, e, id) => toggle(id, el.dataset.id, 'packed'),
    unused: (el, e, id) => toggle(id, el.dataset.id, 'unused'),
    rm: async (el, e, id) => {
      const tour = find('tours', id);
      tour.entries = tour.entries.filter((x) => x.itemId !== el.dataset.id);
      await save('tours', tour);
      refresh();
    },
    add: (el, e, id) => {
      const tour = find('tours', id);
      pickItems({
        title: 'Add to this tour',
        locked: tour.entries.map((x) => x.itemId),
        onDone: async (ids, s) => {
          tour.entries.push(...ids.map((itemId) => ({ itemId, packed: false, unused: false, tag: null })));
          await save('tours', tour);
          s.close();
          refresh();
        },
      });
    },
    finish: async (el, e, id) => {
      const tour = find('tours', id);
      const left = liveEntries(tour).filter((x) => !x.packed);
      // Only packed items count as carried, so offer to tick the rest if they were taken but not ticked.
      if (left.length && (await ask(`${plural(left.length, 'item isn’t', 'items aren’t')} ticked as packed. Did you take ${left.length === 1 ? 'it' : 'them'} too?`, { title: 'Finish tour', ok: 'Yes, I took them' }))) {
        left.forEach((x) => (x.packed = true));
      }
      tour.status = 'review';
      await save('tours', tour);
      window.scrollTo(0, 0);
      refresh();
    },
    save: async (el, e, id) => {
      const tour = find('tours', id);
      tour.status = 'done';
      await save('tours', tour);
      toast('Tour saved');
      location.hash = '#/tours';
    },
    reopen: async (el, e, id) => {
      const tour = find('tours', id);
      tour.status = 'packing';
      await save('tours', tour);
      refresh();
    },
    del: async (el, e, id) => {
      const tour = find('tours', id);
      if (!(await ask(`Delete the ${tour.kitName} tour on ${fmtDate(tour.date, true)}? Its "didn't use" notes go with it.`, { title: 'Delete tour', ok: 'Delete', danger: true }))) return;
      await remove('tours', id);
      location.replace('#/tours');
    },
  },
};

async function toggle(tourId, itemId, key) {
  const tour = find('tours', tourId);
  const entry = tour.entries.find((x) => x.itemId === itemId);
  entry[key] = !entry[key];
  await save('tours', tour);
  refresh();
}

// ---------------- Condition tags ----------------
const saveTags = (tags) => setMeta('tags', tags);

export const tagsView = {
  tab: 'tours',
  render() {
    const tags = tourTags();
    const rows = tags
      .map((t) => {
        const items = t.itemIds.map((id) => find('items', id)).filter(Boolean);
        return `<div class="row"><button class="row-main" data-act="pick" data-id="${t.id}"><span class="row-title">${esc(t.name)}</span>
          <span class="row-sub">${items.length ? esc(items.map((i) => i.name).join(', ')) : 'No extra items yet. Tap to choose'}</span></button>
          <button class="icon-btn" data-act="rename" data-id="${t.id}" aria-label="Rename ${esc(t.name)}">${icon('edit')}</button>
          <button class="icon-btn danger" data-act="del" data-id="${t.id}" aria-label="Delete ${esc(t.name)}">${icon('trash')}</button></div>`;
      })
      .join('');
    return `${header({ title: 'Condition tags', back: 'history' })}
      <div class="page">
        <p class="hint">When you start a tour, pick the conditions and their extra items are added to the checklist. For example: Cold adds a spare puffy and balaclava, Icy adds boot crampons and the ice axe.</p>
        ${rows ? `<div class="list">${rows}</div>` : empty('No tags', 'Tap + to add one.')}
      </div>
      <button class="fab" data-act="new" aria-label="New tag">${icon('plus')}</button>`;
  },
  act: {
    pick: (el) => {
      const tags = tourTags().map((t) => ({ ...t }));
      const tag = tags.find((t) => t.id === el.dataset.id);
      pickItems({
        title: `Extra items: ${tag.name}`,
        chosen: tag.itemIds,
        button: (n) => `Save (${plural(n, 'item')})`,
        onDone: async (ids, s) => {
          tag.itemIds = ids;
          await saveTags(tags);
          s.close();
          refresh();
        },
      });
    },
    rename: async (el) => {
      const tags = tourTags().map((t) => ({ ...t }));
      const tag = tags.find((t) => t.id === el.dataset.id);
      const name = await promptText({ title: 'Rename tag', label: 'Name', value: tag.name });
      if (!name) return;
      tag.name = name;
      await saveTags(tags);
      refresh();
    },
    del: async (el) => {
      const tag = tourTags().find((t) => t.id === el.dataset.id);
      if (!(await ask(`Delete the tag "${tag.name}"? Past tours are not affected.`, { title: 'Delete tag', ok: 'Delete', danger: true }))) return;
      await saveTags(tourTags().filter((t) => t.id !== tag.id));
      refresh();
    },
    new: async () => {
      const name = await promptText({ title: 'New condition tag', label: 'Name', placeholder: 'e.g. Powder', ok: 'Add' });
      if (!name) return;
      await saveTags([...tourTags(), { id: uid(), name, itemIds: [] }]);
      refresh();
    },
  },
};
