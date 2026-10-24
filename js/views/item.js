// One gear item: details, condition, service tasks and the service log.
import { find, save, remove } from '../store.js';
import { esc, fmtW, fmtDate, todayKey, uid, num, norm, plural } from '../util.js';
import { header, icon, openSheet, toast, refresh, field, empty } from '../ui.js';
import { STATUS, CONDITION, conditionOf, makeModel, hasWeight, serviceLog, serviceStatus, dueReasons, suggestedServices } from '../model.js';
import { itemSheet } from '../forms.js';

const COND_BADGE = { good: 'ok', worn: 'warn', repair: 'bad', retired: '' };

function dueBadge(s) {
  if (!s.every) return '';
  if (!s.last) return '<span class="badge warn">Never logged</span>';
  if (s.days < 0) return `<span class="badge bad">${plural(-s.days, 'day')} overdue</span>`;
  if (s.days === 0) return '<span class="badge warn">Due today</span>';
  if (s.days <= 7) return `<span class="badge warn">Due in ${plural(s.days, 'day')}</span>`;
  return `<span>Due ${fmtDate(s.due, true)}</span>`;
}

function servicesHtml(item) {
  const tasks = serviceStatus(item);
  if (!tasks.length) return `<p class="empty-sm">No service tasks. Tap Edit to add one, e.g. “Wax every 21 days”.</p>`;
  return `<div class="list">${tasks
    .map((s) => `<div class="row"><div class="row-main static">
        <span class="row-title">${esc(s.task)}</span>
        <span class="row-sub"><span>${s.every ? `Every ${plural(Number(s.every), 'day')}` : 'No interval'}</span>${s.last ? `<span>Last ${fmtDate(s.last.date, true)}</span>` : ''}${dueBadge(s)}</span>
      </div><button class="chip sm" data-act="done" data-task="${esc(s.task)}">${icon('check')} Done today</button></div>`)
    .join('')}</div>`;
}

function logHtml(item) {
  const log = serviceLog(item.id);
  if (!log.length) return `<p class="empty-sm">Nothing logged yet.</p>`;
  return `<div class="list">${log
    .map((s) => `<button class="row row-main link-row" data-act="log" data-id="${s.id}"><span class="row-text">
      <span class="row-title">${esc(s.task)}</span>
      <span class="row-sub"><span>${fmtDate(s.date, true)}</span>${s.notes ? `<span class="clip">${esc(s.notes)}</span>` : ''}</span></span></button>`)
    .join('')}</div>`;
}

export const itemView = {
  tab: 'gear',
  render(id) {
    const item = find('items', id);
    if (!item) return header({ title: 'Gear item', back: '#/gear' }) + `<div class="page">${empty('This item no longer exists', '<a href="#/gear">Back to your gear</a>')}</div>`;
    const c = conditionOf(item);
    const w = hasWeight(item) ? `${fmtW(item.weight)}${item.qty > 1 ? ` each · ×${item.qty}` : ''}` : '<span class="badge">No weight</span>';
    const badges = [
      `<span class="badge ${COND_BADGE[c]}">${CONDITION[c]}</span>`,
      item.status !== 'own' ? `<span class="badge ${item.status === 'buy' ? 'warn' : ''}">${STATUS[item.status]}</span>` : '',
      item.location ? `<span>${icon('pin')}${esc(item.location)}</span>` : '',
    ].join('');
    const reasons = dueReasons(item);
    return `${header({
      title: item.name,
      sub: makeModel(item),
      back: 'history',
      right: `<button class="icon-btn" data-act="edit" aria-label="Edit gear">${icon('edit')}</button>`,
    })}
      <div class="page">
        <div class="card">
          <div class="sum-row">
            <div><p class="muted">${esc(item.category || 'Other')} · ${w}</p><p class="row-sub">${badges}</p></div>
            ${item.photo ? `<img class="thumb" src="${item.photo}" alt="">` : ''}
          </div>
          ${item.notes ? `<p class="note">${esc(item.notes)}</p>` : ''}
          ${reasons.map((r) => `<p class="warn-line">${icon('alert')} ${esc(r)}</p>`).join('')}
        </div>
        <h3 class="group-h"><span>Service tasks</span><button class="chip sm" data-act="intervals">${icon('edit')} Edit</button></h3>
        ${servicesHtml(item)}
        <button class="btn primary block mt" data-act="add">${icon('plus')} Add service</button>
        <h3 class="group-h"><span>Service log</span><span class="gw">${serviceLog(item.id).length}</span></h3>
        ${logHtml(item)}
      </div>`;
  },
  act: {
    edit: (el, e, id) => itemSheet(find('items', id), { onDeleted: () => location.replace('#/gear') }),
    add: (el, e, id) => serviceSheet(find('items', id), null),
    log: (el, e, id) => serviceSheet(find('items', id), find('services', el.dataset.id)),
    intervals: (el, e, id) => intervalsSheet(find('items', id)),
    done: async (el, e, id) => {
      const entry = await save('services', { id: uid(), itemId: id, date: todayKey(), task: el.dataset.task, notes: '' });
      refresh();
      toast(`Logged: ${entry.task}`, {
        action: 'Undo',
        onAction: async () => {
          await remove('services', entry.id);
          refresh();
        },
      });
    },
  },
};

// Add or edit one service log entry.
function serviceSheet(item, entry) {
  const tasks = serviceStatus(item);
  const known = [...new Set([...tasks.map((s) => s.task), ...serviceLog(item.id).map((s) => s.task)])];
  const e = entry || { date: todayKey(), task: (tasks.find((s) => s.overdue) || tasks[0])?.task || '', notes: '' };
  openSheet({
    title: entry ? 'Edit service' : `Service: ${item.name}`,
    body: `<form id="svf" class="form">
      ${field('Date', `<input type="date" name="date" value="${e.date}">`)}
      ${field('What was done', `<input name="task" list="dl-task" value="${esc(e.task)}" placeholder="e.g. Wax">`)}
      <datalist id="dl-task">${known.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
      ${known.length ? `<div class="chips tight">${known.map((t) => `<button type="button" class="chip sm" data-act="task" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
      ${field('Notes', `<textarea name="notes" rows="3" placeholder="e.g. Hot wax, cold temp; fixed base gouge">${esc(e.notes)}</textarea>`)}
      <p class="hint">Use the same wording as a service task (e.g. “Wax”) to reset its due date.</p>
    </form>`,
    footer: `${entry ? `<button class="btn danger" data-act="del" aria-label="Delete entry">${icon('trash')}</button>` : ''}<button class="btn primary grow" data-act="save">Save</button>`,
    onClick: async (act, el, ev, s) => {
      if (act === 'task') s.$('[name=task]').value = el.dataset.v;
      if (act === 'save') {
        const f = new FormData(s.$('#svf'));
        const task = f.get('task').trim();
        if (!task) {
          s.$('[name=task]').focus();
          return toast('Say what was done');
        }
        // Reuse the exact wording of a matching task so due dates line up.
        const match = known.find((t) => norm(t) === norm(task)) || task;
        await save('services', { ...e, id: e.id || uid(), itemId: item.id, date: f.get('date') || todayKey(), task: match, notes: f.get('notes').trim() });
        s.close();
        toast(entry ? 'Saved' : 'Service logged');
        refresh();
      }
      if (act === 'del') {
        await remove('services', entry.id);
        s.close();
        refresh();
        toast('Entry deleted', {
          action: 'Undo',
          onAction: async () => {
            await save('services', entry);
            refresh();
          },
        });
      }
    },
  });
}

// Edit the list of service tasks and how often each is due.
function intervalsSheet(item) {
  let rows = (item.services || []).map((s) => ({ ...s }));
  const rowsHtml = () =>
    rows.length
      ? rows
          .map((r, i) => `<div class="row edit-row">
            <input class="inline-input" data-i="${i}" data-k="task" value="${esc(r.task)}" placeholder="Task, e.g. Wax" aria-label="Task">
            <input class="inline-input days-input" data-i="${i}" data-k="every" value="${esc(r.every ?? '')}" inputmode="numeric" placeholder="days" aria-label="Every how many days">
            <button type="button" class="icon-btn danger" data-act="rm" data-i="${i}" aria-label="Remove">${icon('trash')}</button></div>`)
          .join('')
      : `<p class="empty-sm">No service tasks.</p>`;
  // Keep what was typed before redrawing the rows.
  const sync = (s) => s.$$('[data-i][data-k]').forEach((inp) => (rows[inp.dataset.i][inp.dataset.k] = inp.value));
  const draw = (s) => (s.$('#iv-rows').innerHTML = rowsHtml());
  openSheet({
    title: 'Service tasks',
    body: `<p class="hint">Each task is due again this many days after you last logged it. Leave the days blank for a task with no schedule.</p>
      <div class="list" id="iv-rows">${rowsHtml()}</div>
      <div class="toolbar mt"><button type="button" class="btn grow" data-act="new">${icon('plus')} Add task</button>
      <button type="button" class="btn grow" data-act="suggest">Suggestions</button></div>`,
    footer: `<button class="btn primary block" data-act="save">Save</button>`,
    onClick: async (act, el, e, s) => {
      sync(s);
      if (act === 'new') {
        rows.push({ id: uid(), task: '', every: '' });
        draw(s);
        s.$(`[data-i="${rows.length - 1}"][data-k=task]`).focus();
      }
      if (act === 'rm') {
        rows.splice(Number(el.dataset.i), 1);
        draw(s);
      }
      if (act === 'suggest') {
        const have = new Set(rows.map((r) => norm(r.task)));
        const extra = suggestedServices(item).filter((r) => !have.has(norm(r.task)));
        if (!extra.length) return toast(suggestedServices(item).length ? 'All suggestions are already added' : 'No suggestions for this kind of item');
        rows.push(...extra);
        draw(s);
      }
      if (act === 'save') {
        item.services = rows
          .map((r) => ({ id: r.id || uid(), task: r.task.trim(), every: num(r.every) ? Math.round(num(r.every)) : null }))
          .filter((r) => r.task);
        await save('items', item);
        s.close();
        refresh();
      }
    },
  });
}
