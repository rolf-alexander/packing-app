// Pre-tour check: a daily checklist that resets itself every morning.
import { data, save, remove, meta, setMeta } from '../store.js';
import { esc, todayKey, uid } from '../util.js';
import { header, icon, refresh, progress, toast, empty } from '../ui.js';

let editing = false;

const checks = () => [...data.checks].sort((a, b) => a.order - b.order);

// Today's ticks. A saved state from an earlier day counts as empty, so the list resets daily.
function today() {
  const s = meta('pretour');
  return s && s.date === todayKey() ? s : { date: todayKey(), done: [] };
}

function viewHtml(list) {
  const st = today();
  const done = list.filter((c) => st.done.includes(c.id)).length;
  const allDone = list.length > 0 && done === list.length;
  if (!list.length) return empty('Your checklist is empty', 'Tap the pencil to add checks.');
  return `<div class="card ${allDone ? 'all-good' : ''}">
      ${allDone
        ? `<p class="big-ok">${icon('shield')} All checked. Have a great tour!</p>`
        : `<p class="muted">${done} of ${list.length} checked · resets every day</p>`}
      ${progress(done, list.length)}
    </div>
    <div class="list big-rows">${list
      .map((c) => {
        const on = st.done.includes(c.id);
        return `<div class="row ${on ? 'done' : ''}">
          <button class="tick" data-act="tick" data-id="${c.id}" aria-pressed="${on}" aria-label="${esc(c.text)}">${icon('check')}</button>
          <button class="row-main" data-act="tick" data-id="${c.id}"><span class="row-title">${esc(c.text)}</span></button></div>`;
      })
      .join('')}</div>
    <button class="btn block mt" data-act="reset">${icon('refresh')} Reset now</button>`;
}

function editHtml(list) {
  return `<p class="hint">Edit the wording, reorder with the arrows, or add your own checks. Changes save automatically.</p>
    <div class="list">${list
      .map((c, i) => `<div class="row edit-row">
        <input class="inline-input" data-check="${c.id}" value="${esc(c.text)}" aria-label="Check text">
        <button class="icon-btn" data-act="move" data-id="${c.id}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('up')}</button>
        <button class="icon-btn" data-act="move" data-id="${c.id}" data-d="1" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon('down')}</button>
        <button class="icon-btn danger" data-act="del" data-id="${c.id}" aria-label="Delete">${icon('trash')}</button></div>`)
      .join('')}</div>
    <form class="add-row" id="add-check"><input id="new-check" placeholder="Add a check…" enterkeyhint="done"><button class="btn primary" data-act="add">Add</button></form>
    <button class="btn block mt" data-act="edit">${icon('check')} Done editing</button>`;
}

export const checkView = {
  tab: 'tours',
  render() {
    const list = checks();
    const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    return `${header({
      title: 'Pre-tour check',
      sub: date,
      back: 'history',
      right: `<button class="icon-btn" data-act="edit" aria-label="${editing ? 'Done editing' : 'Edit checklist'}">${icon(editing ? 'check' : 'edit')}</button>`,
    })}<div class="page">${editing ? editHtml(list) : viewHtml(list)}</div>`;
  },
  mounted(root) {
    root.querySelector('#add-check')?.addEventListener('submit', (e) => {
      e.preventDefault();
      checkView.act.add();
    });
  },
  async onChange(e) {
    const id = e.target.dataset.check;
    if (!id) return;
    const c = data.checks.find((x) => x.id === id);
    const text = e.target.value.trim();
    if (c && text && text !== c.text) {
      c.text = text;
      await save('checks', c);
    }
  },
  act: {
    tick: async (el) => {
      const st = today();
      const id = el.dataset.id;
      st.done = st.done.includes(id) ? st.done.filter((x) => x !== id) : [...st.done, id];
      await setMeta('pretour', st);
      refresh();
    },
    reset: async () => {
      await setMeta('pretour', { date: todayKey(), done: [] });
      refresh();
    },
    edit: () => {
      editing = !editing;
      refresh();
    },
    add: async () => {
      const input = document.getElementById('new-check');
      const text = input.value.trim();
      if (!text) return input.focus();
      const order = Math.max(-1, ...data.checks.map((c) => c.order)) + 1;
      await save('checks', { id: uid(), text, order });
      refresh();
      document.getElementById('new-check')?.focus();
    },
    move: async (el) => {
      const list = checks();
      list.forEach((c, i) => (c.order = i));
      const i = list.findIndex((c) => c.id === el.dataset.id);
      const j = i + Number(el.dataset.d);
      if (j < 0 || j >= list.length) return;
      [list[i].order, list[j].order] = [list[j].order, list[i].order];
      await save('checks', ...list);
      refresh();
    },
    del: async (el) => {
      const c = data.checks.find((x) => x.id === el.dataset.id);
      await remove('checks', c.id);
      refresh();
      toast('Check deleted', {
        action: 'Undo',
        onAction: async () => {
          await save('checks', c);
          refresh();
        },
      });
    },
  },
};
