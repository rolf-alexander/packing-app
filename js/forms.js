// Forms shared between screens: the gear item editor and the multi-select item picker.
import { data, find, save, remove } from './store.js';
import { esc, fmtW, norm, num, uid, resizeImage } from './util.js';
import { icon, openSheet, toast, ask, refresh, field, segment } from './ui.js';
import { STATUS, locations, categories, brands, makeModel, tripsUsing } from './model.js';

export function itemSheet(item, { defaults = {}, onSaved } = {}) {
  const isNew = !item;
  const it = {
    name: '', brand: '', model: '', category: '', weight: null, qty: 1, status: 'own', location: 'With me',
    carryOn: false, price: null, shop: '', notes: '', photo: null, ...defaults, ...(item || {}),
  };
  let photo = it.photo;
  const uses = isNew ? [] : tripsUsing(it.id);

  const photoHtml = () => `
    <div class="photo-box" data-act="photo">${photo ? `<img src="${photo}" alt="">` : icon('camera')}</div>
    <div class="photo-btns">
      <button type="button" class="btn sm" data-act="photo">${photo ? 'Change photo' : 'Add photo'}</button>
      ${photo ? `<button type="button" class="btn sm danger" data-act="nophoto">Remove</button>` : ''}
    </div>`;

  const body = `<form id="itf" class="form" autocomplete="off">
    <div class="photo-pick" id="photo-area">${photoHtml()}</div>
    <input type="file" accept="image/*" id="photo-in" hidden>
    ${field('Name', `<input name="name" value="${esc(it.name)}" placeholder="e.g. Avalanche transceiver" required>`)}
    <div class="grid2">
      ${field('Brand', `<input name="brand" list="dl-brand" value="${esc(it.brand)}" placeholder="e.g. Mammut">`)}
      ${field('Model', `<input name="model" value="${esc(it.model)}" placeholder="e.g. Barryvox S">`)}
    </div>
    <datalist id="dl-brand">${brands().map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
    <p class="hint form-hint">Leave brand and model blank for generic things like socks.</p>
    ${field('Category', `<input name="category" list="dl-cat" value="${esc(it.category)}" placeholder="e.g. Avalanche safety">`)}
    <datalist id="dl-cat">${categories().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
    <div class="grid2">
      ${field('Weight each (g)', `<input name="weight" inputmode="decimal" value="${esc(it.weight ?? '')}" placeholder="0">`)}
      ${field('Quantity', `<input name="qty" inputmode="numeric" value="${esc(it.qty)}">`)}
    </div>
    ${field('Status', segment('status', Object.entries(STATUS), it.status))}
    ${field('Where is it now?', `<input name="location" list="dl-loc" value="${esc(it.location)}" placeholder="e.g. Switzerland">
      <div class="chips tight">${locations().map((l) => `<button type="button" class="chip sm" data-act="loc" data-v="${esc(l)}">${esc(l)}</button>`).join('')}</div>`)}
    <datalist id="dl-loc">${locations().map((l) => `<option value="${esc(l)}">`).join('')}</datalist>
    <label class="switch-row">
      <span><b>Carry-on only</b><small>Lithium batteries, power banks, drone batteries…</small></span>
      <input type="checkbox" class="switch" name="carryOn" ${it.carryOn ? 'checked' : ''}>
    </label>
    <div class="grid2">
      ${field('Price each (CHF)', `<input name="price" inputmode="decimal" value="${esc(it.price ?? '')}" placeholder="for the shopping list">`)}
      ${field('Where to buy', `<input name="shop" value="${esc(it.shop)}" placeholder="e.g. Bächli">`)}
    </div>
    ${field('Notes', `<textarea name="notes" rows="3">${esc(it.notes)}</textarea>`)}
    ${uses.length ? `<p class="hint">On packing lists: ${uses.map((u) => esc(u.trip.name)).join(', ')}</p>` : ''}
  </form>`;

  const footer = isNew
    ? `<button class="btn primary block" data-act="save">Add to gear</button>`
    : `<button class="btn danger" data-act="delete" aria-label="Delete">${icon('trash')}</button><button class="btn primary grow" data-act="save">Save</button>`;

  openSheet({
    title: isNew ? 'New gear item' : 'Edit gear',
    body,
    footer,
    onClick: async (act, el, e, s) => {
      if (act === 'photo') s.$('#photo-in').click();
      if (act === 'nophoto') {
        photo = null;
        s.$('#photo-area').innerHTML = photoHtml();
      }
      if (act === 'loc') s.$('[name=location]').value = el.dataset.v;
      if (act === 'delete' && (await deleteItem(item))) s.close();
      if (act === 'save') {
        const f = new FormData(s.$('#itf'));
        const name = f.get('name').trim();
        if (!name) {
          s.$('[name=name]').focus();
          return toast('Give it a name first');
        }
        const obj = {
          ...(item || {}),
          id: item?.id || uid(),
          name,
          brand: f.get('brand').trim(),
          model: f.get('model').trim(),
          category: f.get('category').trim() || 'Other',
          weight: num(f.get('weight')), // blank stays blank, so it shows under "Missing weight"
          qty: Math.max(1, Math.round(num(f.get('qty')) ?? 1)),
          status: f.get('status') || 'own',
          location: f.get('location').trim(),
          carryOn: f.get('carryOn') === 'on',
          price: num(f.get('price')),
          shop: f.get('shop').trim(),
          notes: f.get('notes').trim(),
          photo,
        };
        await save('items', obj);
        s.close();
        toast(isNew ? `Added ${name}` : 'Saved');
        refresh();
        onSaved?.(obj);
      }
    },
    onChange: async (e, s) => {
      if (e.target.id !== 'photo-in' || !e.target.files[0]) return;
      try {
        photo = await resizeImage(e.target.files[0]);
        s.$('#photo-area').innerHTML = photoHtml();
      } catch (err) {
        toast(err.message);
      }
    },
  });
}

export async function deleteItem(item) {
  const n = tripsUsing(item.id).length;
  const ok = await ask(`Delete "${item.name}" from your gear${n ? ` and from ${n} packing list${n > 1 ? 's' : ''}` : ''}? This can't be undone.`, {
    title: 'Delete gear item',
    ok: 'Delete',
    danger: true,
  });
  if (!ok) return false;
  await remove('tripItems', ...data.tripItems.filter((t) => t.itemId === item.id).map((t) => t.id));
  const tpls = data.templates.filter((t) => t.itemIds.includes(item.id));
  for (const t of tpls) t.itemIds = t.itemIds.filter((id) => id !== item.id);
  if (tpls.length) await save('templates', ...tpls);
  await remove('items', item.id);
  toast(`Deleted ${item.name}`);
  refresh();
  return true;
}

// A searchable list of all gear with checkboxes. `locked` items show as already added.
export function pickItems({ title, chosen = [], locked = [], top = '', button = (n) => (n ? `Add ${n} item${n === 1 ? '' : 's'}` : 'Choose items'), onDone }) {
  const sel = new Set(chosen);
  const lock = new Set(locked);
  let q = '';

  const list = () => {
    const nq = norm(q).trim();
    const items = data.items.filter((i) => !nq || norm(`${i.name} ${makeModel(i)} ${i.category} ${i.location}`).includes(nq));
    if (!items.length) return `<p class="empty-sm">No gear matches “${esc(q)}”.</p>`;
    const cats = [...new Set(items.map((i) => i.category || 'Other'))].sort();
    return cats
      .map((c) => {
        const rows = items
          .filter((i) => (i.category || 'Other') === c)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((i) => {
            const on = sel.has(i.id) || lock.has(i.id);
            const sub = [esc(makeModel(i)), i.weight ? fmtW(i.weight) : '', lock.has(i.id) ? 'already added' : '', i.status !== 'own' ? STATUS[i.status] : ''].filter(Boolean).join(' · ');
            return `<label class="pick ${lock.has(i.id) ? 'locked' : ''}">
              <input type="checkbox" value="${i.id}" ${on ? 'checked' : ''} ${lock.has(i.id) ? 'disabled' : ''}>
              <span class="pick-box">${icon('check')}</span>
              <span class="pick-main"><span>${esc(i.name)}</span>${sub ? `<small>${sub}</small>` : ''}</span>
            </label>`;
          })
          .join('');
        return `<h4 class="group-h"><span>${esc(c)}</span></h4><div class="list">${rows}</div>`;
      })
      .join('');
  };

  const updateButton = (s) => (s.$('[data-act=done]').textContent = button(sel.size));

  openSheet({
    title,
    body: `${top}
      <div class="searchbar">${icon('search')}<input type="search" id="pq" placeholder="Search gear" autocomplete="off"></div>
      <div id="plist">${list()}</div>
      <button class="btn block mt" data-act="newitem">${icon('plus')} New gear item</button>`,
    footer: `<button class="btn primary block" data-act="done">${button(sel.size)}</button>`,
    onInput: (e, s) => {
      if (e.target.id !== 'pq') return;
      q = e.target.value;
      s.$('#plist').innerHTML = list();
    },
    onChange: (e, s) => {
      if (!e.target.matches('#plist input[type=checkbox]')) return;
      if (e.target.checked) sel.add(e.target.value);
      else sel.delete(e.target.value);
      updateButton(s);
    },
    onClick: (act, el, e, s) => {
      if (act === 'done') onDone([...sel], s);
      if (act === 'newitem') {
        itemSheet(null, {
          defaults: { name: q },
          onSaved: (it) => {
            sel.add(it.id);
            s.$('#plist').innerHTML = list();
            updateButton(s);
          },
        });
      }
    },
  });
}
