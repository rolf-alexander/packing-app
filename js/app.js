// Start-up and navigation. Each screen has an address like #/trips or #/trip/<id>/bags.
import { load } from './store.js';
import { seedIfEmpty } from './seed.js';
import { icon, setRenderer, refresh, toast } from './ui.js';
import { tripsView, tripView } from './views/trips.js';
import { gearView } from './views/gear.js';
import { itemView } from './views/item.js';
import { checkView } from './views/check.js';
import { shopView } from './views/shop.js';
import { moreView, searchView } from './views/more.js';
import { kitsView, kitView } from './views/kits.js';
import { toursView, tourView, tagsView } from './views/tours.js';

const routes = [
  [/^#\/trips$/, tripsView],
  [/^#\/trip\/([\w-]+)(?:\/(pack|bags|admin|repack))?$/, tripView],
  [/^#\/gear$/, gearView],
  [/^#\/item\/([\w-]+)$/, itemView],
  [/^#\/check$/, checkView],
  [/^#\/shop$/, shopView],
  [/^#\/more$/, moreView],
  [/^#\/tours$/, toursView],
  [/^#\/tour\/([\w-]+)$/, tourView],
  [/^#\/tags$/, tagsView],
  [/^#\/(?:kits|templates)$/, kitsView],
  [/^#\/(?:kit|template)\/([\w-]+)$/, kitView],
  [/^#\/search$/, searchView],
];

const TABS = [
  ['trips', 'Trips', 'map'],
  ['gear', 'Gear', 'pack'],
  ['tours', 'Tours', 'shield'],
  ['shop', 'Shop', 'cart'],
  ['more', 'More', 'more'],
];

const root = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
let current = null;
let params = [];

function draw() {
  root.innerHTML = current.render(...params);
  current.mounted?.(root, ...params);
}

function route() {
  const hash = location.hash || '#/trips';
  for (const [re, view] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    const same = view === current && m.slice(1).join() === params.join();
    current = view;
    params = m.slice(1);
    draw();
    if (!same) window.scrollTo(0, 0);
    tabbar.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.tab === view.tab));
    return;
  }
  location.replace('#/trips');
}

// Redraw the current screen after a change, keeping the scroll position.
setRenderer(() => {
  if (!current) return;
  const y = window.scrollY;
  draw();
  window.scrollTo(0, y);
});

const report = (err) => {
  console.error(err);
  toast(`Something went wrong: ${err.message}`);
};

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !root.contains(el)) return;
  if (el.dataset.act === 'back') {
    if (history.length > 1) history.back();
    else location.hash = '#/trips';
    return;
  }
  const fn = current?.act?.[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(el, e, ...params)).catch(report);
});
root.addEventListener('input', (e) => current?.onInput?.(e, ...params));
root.addEventListener('change', (e) => Promise.resolve(current?.onChange?.(e, ...params)).catch(report));

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker
    .register('sw.js')
    .then((reg) => {
      const offer = (worker) =>
        toast('A new version of the app is ready', { action: 'Update', ms: 0, onAction: () => worker.postMessage('skip') });
      if (reg.waiting && hadController) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
        });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch((err) => console.warn('Offline support unavailable:', err));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) location.reload();
  });
}

async function start() {
  tabbar.innerHTML = TABS.map(([k, label, ic]) => `<a href="#/${k}" data-tab="${k}">${icon(ic)}<span>${label}</span></a>`).join('');
  try {
    await load();
    await seedIfEmpty();
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="page"><div class="empty"><h3>Couldn't open your data</h3><p>${String(err.message || err)}</p>
      <p>If you're in a private browsing window, open the app normally.</p></div></div>`;
    return;
  }
  // Ask the browser not to clear our data when storage is low.
  navigator.storage?.persist?.().catch(() => {});
  window.addEventListener('hashchange', route);
  route();
  // The pre-tour check resets at midnight, so redraw when the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !document.querySelector('.sheet-wrap')) refresh();
  });
  registerServiceWorker();
}

start();
