// Fonctions utilitaires partagées par toute l'application.

export const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

const PASSWORD_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function generateTempPassword(length = 10) {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => PASSWORD_CHARS[v % PASSWORD_CHARS.length]).join('');
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

// monthIndex0 = 0..11
export function monthKey(year, monthIndex0) {
  return `${year}-${pad2(monthIndex0 + 1)}`;
}

export function parseMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return { year: y, monthIndex0: m - 1 };
}

export function quarterOfMonthIndex(monthIndex0) {
  return Math.floor(monthIndex0 / 3) + 1; // 1..4
}

export function monthsInQuarter(quarter) {
  const start = (quarter - 1) * 3;
  return [start, start + 1, start + 2];
}

// Regroupe une date du mois en semaine 1 à 4 (les jours 22 à 31 sont comptés
// dans la semaine 4, comme dans les tableaux Excel d'origine à 4 colonnes).
export function weekOfMonth(dateISO) {
  const d = new Date(dateISO);
  const day = d.getDate();
  return Math.min(4, Math.ceil(day / 7));
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtNum(x) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  return new Intl.NumberFormat('fr-FR').format(x);
}

export function fmtPct(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return `${Math.round(x * 100)}%`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR');
}

export function fmtMoney(x) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  return new Intl.NumberFormat('fr-FR').format(x) + ' F';
}

export function pctClass(pct) {
  if (pct === null || !Number.isFinite(pct)) return 'neutral';
  if (pct >= 1) return 'good';
  if (pct >= 0.7) return 'warn';
  return 'bad';
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Convertit un numéro de série Excel (1900 date system) en date ISO (yyyy-mm-dd).
export function excelSerialToISO(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  const utcDays = Math.floor(serial - 25569);
  const ms = utcDays * 86400 * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
