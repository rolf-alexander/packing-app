// Small helpers used all over the app.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export const unique = (arr) => [...new Set(arr.filter((x) => x != null && x !== ''))];
export const byName = (a, b) => a.name.localeCompare(b.name);
export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;

// Parses "12", "12.5" or "12,5" (Swiss keyboards use a comma). Returns null for empty or invalid input.
export function num(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function fmtW(g) {
  g = Math.round(Number(g) || 0);
  return Math.abs(g) < 1000 ? `${g} g` : `${(g / 1000).toFixed(1)} kg`;
}

export const money = (n) => (n == null || n === '' || isNaN(n) ? '' : `CHF ${Number(n).toFixed(2)}`);

// Dates are stored as "YYYY-MM-DD" strings in local time.
export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(key, n) {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return todayKey(d);
}
export const daysUntil = (key) => Math.round((parseDay(key) - parseDay(todayKey())) / 86400000);

export function fmtDate(key, withYear = false) {
  if (!key) return '';
  return parseDay(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}
export function fmtRange(a, b) {
  if (!a) return 'No dates yet';
  return b ? `${fmtDate(a)} – ${fmtDate(b, true)}` : fmtDate(a, true);
}

export function toCSV(rows) {
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

// Handles quotes, and both comma and semicolon separated files (Excel in Switzerland uses ";").
export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delim = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

// On iPhone this opens the share sheet ("Save to Files", AirDrop, Mail…); on a computer it downloads.
export async function saveFile(name, content, type) {
  const blob = new Blob([content], { type });
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare) {
    const file = new File([blob], name, { type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false;
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

// Shrinks a photo so the database stays small (about 50–100 KB per photo).
export function resizeImage(file, max = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}
