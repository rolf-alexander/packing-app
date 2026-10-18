// Shared interface pieces: icons, page header, bottom sheets, toasts.
import { esc } from './util.js';

const PATHS = {
  back: '<path d="m15 18-6-6 6-6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
  pack: '<path d="M5 10a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M8 14h8v4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  refresh: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  tasks: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
};

export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] || ''}</svg>`;

// Re-rendering: app.js registers the function that redraws the current screen.
let renderer = () => {};
export const setRenderer = (fn) => (renderer = fn);
export const refresh = () => renderer();

export function header({ title, sub = '', back = '', right = '', extra = '' }) {
  const backBtn =
    back === 'history'
      ? `<button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button>`
      : back
        ? `<a class="icon-btn" href="${back}" aria-label="Back">${icon('back')}</a>`
        : '';
  return `<header class="top"><div class="top-row">${backBtn}
    <div class="top-title"><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
    <div class="top-right">${right}<a class="icon-btn" href="#/search" aria-label="Search everything">${icon('search')}</a></div>
  </div>${extra}</header>`;
}

export const field = (label, control, hint = '') =>
  `<div class="field"><span class="flabel">${label}</span>${control}${hint ? `<small class="hint">${hint}</small>` : ''}</div>`;

export const segment = (name, options, value) =>
  `<div class="segment">${options
    .map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === value ? 'checked' : ''}><span>${esc(l)}</span></label>`)
    .join('')}</div>`;

export function progress(done, total, cls = '') {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<div class="bar ${pct === 100 ? 'ok' : ''} ${cls}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>`;
}

export const empty = (title, text = '') => `<div class="empty"><h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}</div>`;

// ---------- Bottom sheets (pop-up panels that slide up from the bottom) ----------
const stack = [];

export function openSheet({ title, body, footer = '', onClick, onInput, onChange, onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop" data-close></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grab"></div>
      <header class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
      <div class="sheet-body">${body}</div>
      ${footer ? `<footer class="sheet-foot">${footer}</footer>` : ''}
    </section>`;
  document.body.append(wrap);
  document.body.classList.add('noscroll');
  let closed = false;
  const api = {
    el: wrap,
    $: (s) => wrap.querySelector(s),
    $$: (s) => [...wrap.querySelectorAll(s)],
    setBody: (html) => (wrap.querySelector('.sheet-body').innerHTML = html),
    setFooter: (html) => (wrap.querySelector('.sheet-foot').innerHTML = html),
    close() {
      if (closed) return;
      closed = true;
      stack.splice(stack.indexOf(api), 1);
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 220);
      if (!stack.length) document.body.classList.remove('noscroll');
      onClose?.();
    },
  };
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return api.close();
    const el = e.target.closest('[data-act]');
    if (el && onClick) {
      Promise.resolve(onClick(el.dataset.act, el, e, api)).catch((err) => {
        console.error(err);
        toast(`Something went wrong: ${err.message}`);
      });
    }
  });
  wrap.addEventListener('submit', (e) => e.preventDefault());
  if (onInput) wrap.addEventListener('input', (e) => onInput(e, api));
  if (onChange) wrap.addEventListener('change', (e) => onChange(e, api));
  stack.push(api);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  return api;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close();
});

export function ask(message, { title = 'Are you sure?', ok = 'OK', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    openSheet({
      title,
      body: `<p class="lead">${esc(message)}</p>`,
      footer: `<button class="btn grow" data-close>Cancel</button><button class="btn grow ${danger ? 'danger-fill' : 'primary'}" data-act="ok">${esc(ok)}</button>`,
      onClick: (act, el, e, s) => {
        if (act === 'ok') {
          answered = true;
          resolve(true);
          s.close();
        }
      },
      onClose: () => !answered && resolve(false),
    });
  });
}

export function promptText({ title, label, value = '', ok = 'Save', placeholder = '' }) {
  return new Promise((resolve) => {
    let answered = false;
    const s = openSheet({
      title,
      body: `<form class="form">${field(label, `<input name="v" value="${esc(value)}" placeholder="${esc(placeholder)}" enterkeyhint="done">`)}</form>`,
      footer: `<button class="btn primary block" data-act="ok">${esc(ok)}</button>`,
      onClick: (act, el, e, sh) => {
        if (act !== 'ok') return;
        const v = sh.$('[name=v]').value.trim();
        if (!v) return sh.$('[name=v]').focus();
        answered = true;
        resolve(v);
        sh.close();
      },
      onClose: () => !answered && resolve(null),
    });
    s.$('form').addEventListener('submit', () => s.$('[data-act=ok]').click());
    setTimeout(() => s.$('[name=v]').focus(), 250);
  });
}

// ---------- Toasts (short messages at the bottom) ----------
export function toast(msg, { action, onAction, ms = 3200 } = {}) {
  const box = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  const hide = () => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 250);
  };
  t.querySelector('button')?.addEventListener('click', () => {
    hide();
    onAction?.();
  });
  box.append(t);
  if (ms) setTimeout(hide, ms);
  return hide;
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {}
}

// Uses the iPhone share sheet when available, otherwise copies to the clipboard.
export async function shareOrCopy(text, title) {
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title, text });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied. Paste it into a message');
  } catch {
    toast('Select the text and copy it');
  }
}
