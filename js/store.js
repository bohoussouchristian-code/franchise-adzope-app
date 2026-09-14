import { uid, monthKey, parseMonthKey, weekOfMonth, monthsInQuarter } from './utils.js';

const STORAGE_KEY = 'fa2026_state_v1';

// Objectifs annuels par défaut, repris du récapitulatif annuel du modèle Excel
// ("REAL ANNEE 2026 adz PH.xlsx"). Répartis également sur 12 mois par défaut ;
// modifiables ensuite mois par mois dans l'onglet Objectifs.
const DEFAULT_PRODUCTS = [
  { id: 'packs', name: 'Packs', unit: 'pack', annual: 240, autoFromRegistry: false },
  { id: 'cofina', name: 'Cofina', unit: 'dossier', annual: 132, autoFromRegistry: false },
  { id: 'ghome4', name: '4G Home', unit: 'abonnement', annual: 60, autoFromRegistry: true },
  { id: 'fibreup', name: 'Fibre Up', unit: 'abonnement', annual: 60, autoFromRegistry: false },
  { id: 'qrcode', name: 'QR Code', unit: 'vente', annual: 192, autoFromRegistry: false },
  { id: 'maxit', name: 'Max-it', unit: 'vente', annual: 204, autoFromRegistry: false },
  { id: 'carteoba', name: 'Carte Oba', unit: 'carte', annual: 24, autoFromRegistry: false },
  { id: 'cartevirtoba', name: 'Carte virtuelle OBA', unit: 'carte', annual: 96, autoFromRegistry: false },
  { id: 'frequentation', name: 'Fréquentation', unit: 'visite', annual: 3120, autoFromRegistry: false },
  { id: 'clientmystere', name: 'Client mystère', unit: 'visite', annual: 40, autoFromRegistry: false },
  { id: 'evaluation', name: 'Évaluation', unit: 'point', annual: 120, autoFromRegistry: false },
];

const DEFAULT_OUTLETS = [
  'EO Adzopé', 'EO Akoupé', 'BT Agou', 'MF Yakassé Attobrou', 'FR Akoupé'
];

function defaultState() {
  const year = new Date().getFullYear();
  const agents = [1, 2, 3, 4].map((n) => ({ id: uid('agt'), name: `Vendeur ${n}` }));
  const outlets = DEFAULT_OUTLETS.map((name) => ({ id: uid('out'), name }));
  const products = DEFAULT_PRODUCTS.map((p) => ({ ...p }));
  return {
    version: 1,
    meta: { franchiseName: 'TEAM FRANCHISE ADZOPE', city: 'Adzopé', year },
    agents,
    outlets,
    products,
    objectives: {}, // [agentId][productId][monthKey] = { objective, weeks: [w1,w2,w3,w4] }
    subscriptions4gHome: [], // registre détaillé 4G Home
  };
}

let state = null;

export function loadState() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
      migrateState(state);
      return state;
    }
  } catch (e) {
    console.error('Lecture des données locales impossible, réinitialisation.', e);
  }
  state = defaultState();
  saveState(state);
  return state;
}

function migrateState(s) {
  if (!s.meta) s.meta = { franchiseName: 'TEAM FRANCHISE ADZOPE', city: 'Adzopé', year: new Date().getFullYear() };
  if (!s.agents) s.agents = [];
  if (!s.outlets) s.outlets = DEFAULT_OUTLETS.map((name) => ({ id: uid('out'), name }));
  if (!s.products) s.products = DEFAULT_PRODUCTS.map((p) => ({ ...p }));
  if (!s.objectives) s.objectives = {};
  if (!s.subscriptions4gHome) s.subscriptions4gHome = [];
}

export function saveState(s) {
  state = s;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function resetState() {
  state = defaultState();
  saveState(state);
  return state;
}

// ---------- Objectifs ----------

export function getObjectiveEntry(s, agentId, productId, mKey, createIfMissing = false) {
  if (!s.objectives[agentId]) {
    if (!createIfMissing) return null;
    s.objectives[agentId] = {};
  }
  if (!s.objectives[agentId][productId]) {
    if (!createIfMissing) return null;
    s.objectives[agentId][productId] = {};
  }
  if (!s.objectives[agentId][productId][mKey]) {
    if (!createIfMissing) return null;
    s.objectives[agentId][productId][mKey] = { objective: 0, weeks: [0, 0, 0, 0], comment: '' };
  }
  const entry = s.objectives[agentId][productId][mKey];
  if (entry.comment === undefined) entry.comment = '';
  return entry;
}

export function setObjective(s, agentId, productId, mKey, objective) {
  const e = getObjectiveEntry(s, agentId, productId, mKey, true);
  e.objective = Number(objective) || 0;
}

export function setWeekActual(s, agentId, productId, mKey, weekIndex0, value) {
  const e = getObjectiveEntry(s, agentId, productId, mKey, true);
  e.weeks[weekIndex0] = Number(value) || 0;
}

export function setComment(s, agentId, productId, mKey, comment) {
  const e = getObjectiveEntry(s, agentId, productId, mKey, true);
  e.comment = comment;
}

// Crée ou met à jour en une fois un objectif complet (utilisé par le
// formulaire modal "+ Nouvel objectif").
export function upsertObjective(s, agentId, productId, mKey, { objective, weeks, comment }) {
  const e = getObjectiveEntry(s, agentId, productId, mKey, true);
  e.objective = Number(objective) || 0;
  e.weeks = Array.from({ length: 4 }, (_, i) => Number(weeks[i]) || 0);
  e.comment = comment || '';
}

export function removeObjectiveEntry(s, agentId, productId, mKey) {
  if (s.objectives[agentId] && s.objectives[agentId][productId]) {
    delete s.objectives[agentId][productId][mKey];
  }
}

// Aplati le registre des objectifs en lignes prêtes à afficher (tableau de
// suivi et historique), en recalculant objectif/réalisé/GAP/% via
// computeProductMonth pour rester cohérent avec le reste de l'application.
export function listObjectiveRows(s, filters = {}) {
  const { agentId = 'ALL', year = 'ALL', productId = 'ALL' } = filters;
  const rows = [];
  for (const aId of Object.keys(s.objectives)) {
    if (agentId !== 'ALL' && aId !== agentId) continue;
    const agent = s.agents.find((a) => a.id === aId);
    for (const pId of Object.keys(s.objectives[aId])) {
      if (productId !== 'ALL' && pId !== productId) continue;
      const product = s.products.find((p) => p.id === pId);
      for (const mKey of Object.keys(s.objectives[aId][pId])) {
        const { year: y, monthIndex0 } = parseMonthKey(mKey);
        if (year !== 'ALL' && y !== Number(year)) continue;
        const entry = s.objectives[aId][pId][mKey];
        const hasData = entry.objective || entry.weeks.some((w) => w) || entry.comment;
        if (!hasData) continue;
        const r = computeProductMonth(s, aId, pId, mKey);
        rows.push({
          agentId: aId,
          agentName: agent ? agent.name : '(vendeur supprimé)',
          productId: pId,
          productName: product ? product.name : pId,
          autoFromRegistry: !!(product && product.autoFromRegistry),
          mKey,
          year: y,
          monthIndex0,
          objective: r.objective,
          weeks: r.weeks,
          realized: r.realized,
          gap: r.gap,
          pct: r.pct,
          comment: entry.comment || '',
        });
      }
    }
  }
  rows.sort((a, b) => b.mKey.localeCompare(a.mKey) || a.agentName.localeCompare(b.agentName));
  return rows;
}

// Réalisé hebdo pour un produit "auto" (4G Home) à partir du registre d'abonnements.
function realizedWeeksFromRegistry(s, agentId, productId, mKey) {
  const weeks = [0, 0, 0, 0];
  if (productId !== 'ghome4') return weeks;
  for (const sub of s.subscriptions4gHome) {
    if (!sub.dateCreation) continue;
    if (!sub.dateCreation.startsWith(mKey)) continue;
    if (agentId !== 'ALL' && sub.agentId !== agentId) continue;
    const w = weekOfMonth(sub.dateCreation);
    weeks[w - 1] += 1;
  }
  return weeks;
}

// Calcule Objectif / Réalisé / GAP / % pour un produit, un agent (ou 'ALL'), un mois donné.
export function computeProductMonth(s, agentId, productId, mKey) {
  const product = s.products.find((p) => p.id === productId);
  const agentIds = agentId === 'ALL' ? s.agents.map((a) => a.id) : [agentId];

  let objective = 0;
  let weeks = [0, 0, 0, 0];

  for (const aId of agentIds) {
    const entry = getObjectiveEntry(s, aId, productId, mKey, false);
    objective += entry ? entry.objective : 0;
    if (product && product.autoFromRegistry) {
      const rw = realizedWeeksFromRegistry(s, aId, productId, mKey);
      weeks = weeks.map((v, i) => v + rw[i]);
    } else if (entry) {
      weeks = weeks.map((v, i) => v + (entry.weeks[i] || 0));
    }
  }

  const realized = weeks.reduce((a, b) => a + b, 0);
  const gap = realized - objective;
  const pct = objective > 0 ? realized / objective : (realized > 0 ? Infinity : null);
  return { objective, weeks, realized, gap, pct };
}

export function computeProductPeriod(s, agentId, productId, period) {
  // period: { type: 'month', year, monthIndex0 } | { type:'quarter', year, quarter } | { type:'year', year }
  let monthIndexes;
  if (period.type === 'month') monthIndexes = [period.monthIndex0];
  else if (period.type === 'quarter') monthIndexes = monthsInQuarter(period.quarter);
  else monthIndexes = Array.from({ length: 12 }, (_, i) => i);

  let objective = 0;
  let realized = 0;
  for (const mi of monthIndexes) {
    const mk = monthKey(period.year, mi);
    const r = computeProductMonth(s, agentId, productId, mk);
    objective += r.objective;
    realized += r.realized;
  }
  const gap = realized - objective;
  const pct = objective > 0 ? realized / objective : (realized > 0 ? Infinity : null);
  return { objective, realized, gap, pct };
}

// ---------- Agents / Points de vente / Produits ----------

export function addAgent(s, name) {
  const a = { id: uid('agt'), name: name.trim() };
  s.agents.push(a);
  return a;
}

export function renameAgent(s, id, name) {
  const a = s.agents.find((x) => x.id === id);
  if (a) a.name = name.trim();
}

export function removeAgent(s, id) {
  s.agents = s.agents.filter((a) => a.id !== id);
  delete s.objectives[id];
  s.subscriptions4gHome.forEach((sub) => { if (sub.agentId === id) sub.agentId = null; });
}

export function addOutlet(s, name) {
  const o = { id: uid('out'), name: name.trim() };
  s.outlets.push(o);
  return o;
}

export function renameOutlet(s, id, name) {
  const o = s.outlets.find((x) => x.id === id);
  if (o) o.name = name.trim();
}

export function removeOutlet(s, id) {
  s.outlets = s.outlets.filter((o) => o.id !== id);
  s.subscriptions4gHome.forEach((sub) => { if (sub.outletId === id) sub.outletId = null; });
}

// ---------- Abonnements 4G Home ----------

export function addSubscription(s, data) {
  const rec = {
    id: uid('sub'),
    dateCreation: data.dateCreation || null,
    agentId: data.agentId || null,
    outletId: data.outletId || null,
    loginSaisie: data.loginSaisie || '',
    loginPaiement: data.loginPaiement || '',
    dateDepotAvantages: data.dateDepotAvantages || null,
    type: data.type === 'FDD' ? 'FDD' : 'TDD',
    numeroClient: data.numeroClient || '',
    numeroFixe: data.numeroFixe || '',
    infoClient: data.infoClient || '',
    referenceFacture: data.referenceFacture || '',
    coutFactureInitiale: Number(data.coutFactureInitiale) || 0,
    modePaiement: data.modePaiement || '',
  };
  s.subscriptions4gHome.unshift(rec);
  return rec;
}

export function updateSubscription(s, id, data) {
  const rec = s.subscriptions4gHome.find((r) => r.id === id);
  if (!rec) return;
  Object.assign(rec, data, {
    coutFactureInitiale: data.coutFactureInitiale !== undefined
      ? Number(data.coutFactureInitiale) || 0
      : rec.coutFactureInitiale,
  });
}

export function removeSubscription(s, id) {
  s.subscriptions4gHome = s.subscriptions4gHome.filter((r) => r.id !== id);
}

export { DEFAULT_PRODUCTS };
