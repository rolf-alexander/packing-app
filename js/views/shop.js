// Shopping list: every gear item marked "Need to buy".
import { data, find, save } from '../store.js';
import { esc, money, plural } from '../util.js';
import { header, icon, refresh, toast, empty } from '../ui.js';
import { tripsUsing } from '../model.js';
import { itemSheet } from '../forms.js';
import { exportShopCSV } from '../backup.js';

export const shopView = {
  tab: 'shop',
  render() {
    const items = data.items.filter((i) => i.status === 'buy').sort((a, b) => a.name.localeCompare(b.name));
    const total = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
    const noPrice = items.filter((i) => i.price == null || i.price === '').length;
    const rows = items
      .map((i) => {
        const trips = [...new Set(tripsUsing(i.id).map((u) => u.trip.name))];
        const line = i.price != null && i.price !== '' ? `${i.qty > 1 ? `${i.qty} × ${money(i.price)} = ` : ''}<b>${money(i.price * (i.qty || 1))}</b>` : '<span class="t-warn">No price yet</span>';
        return `<div class="row">
          <button class="row-main" data-act="item" data-id="${i.id}">
            <span class="row-title">${esc(i.name)}</span>
            <span class="row-sub"><span>${line}</span>${i.shop ? `<span>${icon('pin')}${esc(i.shop)}</span>` : ''}${trips.length ? `<span>for ${esc(trips.join(', '))}</span>` : ''}</span>
          </button>
          <button class="chip sm buy-btn" data-act="bought" data-id="${i.id}">${icon('check')} Bought</button>
        </div>`;
      })
      .join('');
    return `${header({ title: 'Shopping list' })}
      <div class="page">
        <div class="card sum-row">
          <div><div class="big">${money(total) || 'CHF 0.00'}</div><p class="muted">${plural(items.length, 'item')} to buy${noPrice ? ` · ${noPrice} without a price` : ''}</p></div>
          <button class="btn" data-act="csv" ${items.length ? '' : 'disabled'}>${icon('download')} CSV</button>
        </div>
        ${rows ? `<div class="list">${rows}</div>` : empty('Nothing to buy', 'In Gear, set an item’s status to “Need to buy” and it appears here. Tap + to add something new.')}
      </div>
      <button class="fab" data-act="new" aria-label="Add something to buy">${icon('plus')}</button>`;
  },
  act: {
    item: (el) => itemSheet(find('items', el.dataset.id)),
    new: () => itemSheet(null, { defaults: { status: 'buy', location: '' } }),
    csv: () => exportShopCSV(),
    bought: async (el) => {
      const it = find('items', el.dataset.id);
      it.status = 'own';
      await save('items', it);
      refresh();
      toast(`${it.name} moved to your gear`, {
        action: 'Undo',
        onAction: async () => {
          it.status = 'buy';
          await save('items', it);
          refresh();
        },
      });
    },
  },
};
