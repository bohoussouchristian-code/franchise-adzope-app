import { uid, monthKey, parseMonthKey, weekOfMonth, monthsInQuarter } from './utils.js';

const STORAGE_KEY = 'fa2026_state_v1';

// Objectifs annuels par défaut, repris du récapitulatif annuel du modèle Excel
// ("REAL ANNEE 2026 adz PH.xlsx"). Répartis également sur 12 mois par défaut ;
// modifiables ensuite mois par mois dans l'onglet Objectifs.
const DEFAULT_PRODUCTS = [
  { id: 'packs', name: 'Packs', unit: 'pack', annual: 240, autoFromRegistry: false },
  { id: 'cofina', name: 'Cofina', unit: 'dossier', annual: 132, autoFromRegistry: false },
  { id: 'ghome4', name: '4G Home', unit: 'abonnement', annual: 60, autoFromRegistry: true },
  { id: 'fibreup', name: 'Fibre Up', unit: 'abonnement', annual: 60, autoFromRegistry: true },
  { id: 'smartphone', name: 'Smartphones', unit: 'vente', annual: 0, autoFromRegistry: true },
  { id: 'qrcode', name: 'QR Code', unit: 'vente', annual: 192, autoFromRegistry: false },
  { id: 'maxit', name: 'Max-it', unit: 'vente', annual: 204, autoFromRegistry: false },
  { id: 'carteoba', name: 'Carte Oba', unit: 'carte', annual: 24, autoFromRegistry: false },
  { id: 'cartevirtoba', name: 'Carte virtuelle OBA', unit: 'carte', annual: 96, autoFromRegistry: false },
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
    subscriptionsFibre: [], // registre détaillé Fibre
    salesSmartphones: [], // registre détaillé ventes Smartphones (cash / crédit)
    ratings: { frequentation: {}, clientMystere: {} },
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

const RETIRED_PRODUCT_IDS = ['frequentation', 'clientmystere', 'evaluation'];

function migrateState(s) {
  if (!s.meta) s.meta = { franchiseName: 'TEAM FRANCHISE ADZOPE', city: 'Adzopé', year: new Date().getFullYear() };
  if (!s.agents) s.agents = [];
  if (!s.outlets) s.outlets = DEFAULT_OUTLETS.map((name) => ({ id: uid('out'), name }));
  if (!s.products) s.products = DEFAULT_PRODUCTS.map((p) => ({ ...p }));
  if (!s.objectives) s.objectives = {};
  if (!s.subscriptions4gHome) s.subscriptions4gHome = [];
  if (!s.subscriptionsFibre) s.subscriptionsFibre = [];
  if (!s.salesSmartphones) s.salesSmartphones = [];
  if (!s.ratings) s.ratings = {};
  if (!s.ratings.frequentation) s.ratings.frequentation = {};
  if (!s.ratings.clientMystere) s.ratings.clientMystere = {};

  // Fréquentation, Client mystère et Évaluation quittent la fiche d'objectifs
  // par produit pour le sous-module Notation (par point de vente / par vendeur).
  s.products = s.products.filter((p) => !RETIRED_PRODUCT_IDS.includes(p.id));
  Object.values(s.objectives).forEach((byProduct) => {
    RETIRED_PRODUCT_IDS.forEach((pid) => delete byProduct[pid]);
  });

  // Ajoute les nouveaux produits par défaut (Smartphones...) aux états existants
  // et bascule Fibre Up en produit automatique (alimenté par son propre registre).
  const existingProductIds = new Set(s.products.map((p) => p.id));
  DEFAULT_PRODUCTS.forEach((dp) => {
    if (!existingProductIds.has(dp.id)) s.products.push({ ...dp });
  });
  const fibreProduct = s.products.find((p) => p.id === 'fibreup');
  if (fibreProduct) fibreProduct.autoFromRegistry = true;
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

// Associe chaque produit "auto" à son registre détaillé dans l'état.
const AUTO_PRODUCT_REGISTRY = {
  ghome4: 'subscriptions4gHome',
  fibreup: 'subscriptionsFibre',
  smartphone: 'salesSmartphones',
};

// Réalisé hebdo pour un produit "auto" (4G Home, Fibre, Smartphones) à partir de son registre détaillé.
function realizedWeeksFromRegistry(s, agentId, productId, mKey) {
  const weeks = [0, 0, 0, 0];
  const registryKey = AUTO_PRODUCT_REGISTRY[productId];
  if (!registryKey) return weeks;
  for (const rec of s[registryKey] || []) {
    if (!rec.dateCreation) continue;
    if (!rec.dateCreation.startsWith(mKey)) continue;
    if (agentId !== 'ALL' && rec.agentId !== agentId) continue;
    const w = weekOfMonth(rec.dateCreation);
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
  s.subscriptionsFibre.forEach((sub) => { if (sub.agentId === id) sub.agentId = null; });
  s.salesSmartphones.forEach((sale) => { if (sale.agentId === id) sale.agentId = null; });
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
  s.subscriptionsFibre.forEach((sub) => { if (sub.outletId === id) sub.outletId = null; });
  s.salesSmartphones.forEach((sale) => { if (sale.outletId === id) sale.outletId = null; });
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

// ---------- Fibre ----------

export function addFibreSubscription(s, data) {
  const rec = {
    id: uid('fib'),
    dateCreation: data.dateCreation || null,
    agentId: data.agentId || null,
    outletId: data.outletId || null,
    loginSaisie: data.loginSaisie || '',
    loginPaiement: data.loginPaiement || '',
    dateDepotAvantages: data.dateDepotAvantages || null,
    numeroClient: data.numeroClient || '',
    numeroFixe: data.numeroFixe || '',
    infoClient: data.infoClient || '',
    referenceFacture: data.referenceFacture || '',
    coutFactureInitiale: Number(data.coutFactureInitiale) || 0,
    modePaiement: data.modePaiement || '',
  };
  s.subscriptionsFibre.unshift(rec);
  return rec;
}

export function updateFibreSubscription(s, id, data) {
  const rec = s.subscriptionsFibre.find((r) => r.id === id);
  if (!rec) return;
  Object.assign(rec, data, {
    coutFactureInitiale: data.coutFactureInitiale !== undefined
      ? Number(data.coutFactureInitiale) || 0
      : rec.coutFactureInitiale,
  });
}

export function removeFibreSubscription(s, id) {
  s.subscriptionsFibre = s.subscriptionsFibre.filter((r) => r.id !== id);
}

// ---------- Smartphones (vente cash / crédit) ----------

export function smartphoneReste(rec) {
  return Math.max(0, (rec.prixTotal || 0) - (rec.avanceVersee || 0));
}

export function addSmartphoneSale(s, data) {
  const prixTotal = Number(data.prixTotal) || 0;
  const modeVente = data.modeVente === 'CREDIT' ? 'CREDIT' : 'CASH';
  const avanceVersee = modeVente === 'CASH' ? prixTotal : Math.min(Number(data.avanceVersee) || 0, prixTotal);
  const rec = {
    id: uid('smp'),
    dateCreation: data.dateCreation || null,
    agentId: data.agentId || null,
    outletId: data.outletId || null,
    infoClient: data.infoClient || '',
    numeroClient: data.numeroClient || '',
    modele: data.modele || '',
    modeVente,
    prixTotal,
    avanceVersee,
    referenceFacture: data.referenceFacture || '',
    modePaiement: data.modePaiement || '',
  };
  s.salesSmartphones.unshift(rec);
  return rec;
}

export function updateSmartphoneSale(s, id, data) {
  const rec = s.salesSmartphones.find((r) => r.id === id);
  if (!rec) return;
  const prixTotal = data.prixTotal !== undefined ? Number(data.prixTotal) || 0 : rec.prixTotal;
  const modeVente = data.modeVente !== undefined ? (data.modeVente === 'CREDIT' ? 'CREDIT' : 'CASH') : rec.modeVente;
  const avanceVersee = modeVente === 'CASH'
    ? prixTotal
    : Math.min(data.avanceVersee !== undefined ? Number(data.avanceVersee) || 0 : rec.avanceVersee, prixTotal);
  Object.assign(rec, data, { prixTotal, modeVente, avanceVersee });
}

export function removeSmartphoneSale(s, id) {
  s.salesSmartphones = s.salesSmartphones.filter((r) => r.id !== id);
}

// ---------- Évaluation automatique des vendeurs (performance vs objectif) ----------
// Entièrement calculée à partir du module Objectifs : aucune saisie manuelle.
// Agrège Objectif / Réalisé sur tous les produits pour un vendeur et un mois donnés.

export function computeAgentMonthPerformance(s, agentId, mKey) {
  let objective = 0;
  let realized = 0;
  s.products.forEach((p) => {
    const r = computeProductMonth(s, agentId, p.id, mKey);
    objective += r.objective;
    realized += r.realized;
  });
  const gap = realized - objective;
  const pct = objective > 0 ? realized / objective : (realized > 0 ? Infinity : null);
  return { objective, realized, gap, pct };
}

// Liste la performance mensuelle de chaque vendeur ayant au moins un
// objectif fixé sur un produit ce mois-là (même logique de filtrage que
// listObjectiveRows, pour rester cohérent avec le reste de l'application).
export function listAgentPerformanceRows(s, filters = {}) {
  const { agentId = 'ALL', year = 'ALL' } = filters;
  const monthsByAgent = new Map();
  for (const aId of Object.keys(s.objectives)) {
    if (agentId !== 'ALL' && aId !== agentId) continue;
    for (const pId of Object.keys(s.objectives[aId])) {
      for (const mKey of Object.keys(s.objectives[aId][pId])) {
        const entry = s.objectives[aId][pId][mKey];
        const hasData = entry.objective || entry.weeks.some((w) => w) || entry.comment;
        if (!hasData) continue;
        if (!monthsByAgent.has(aId)) monthsByAgent.set(aId, new Set());
        monthsByAgent.get(aId).add(mKey);
      }
    }
  }

  const rows = [];
  for (const [aId, mKeys] of monthsByAgent) {
    const agent = s.agents.find((a) => a.id === aId);
    for (const mKey of mKeys) {
      const { year: y, monthIndex0 } = parseMonthKey(mKey);
      if (year !== 'ALL' && y !== Number(year)) continue;
      const perf = computeAgentMonthPerformance(s, aId, mKey);
      rows.push({
        agentId: aId,
        agentName: agent ? agent.name : '(vendeur supprimé)',
        mKey, year: y, monthIndex0,
        objective: perf.objective,
        realized: perf.realized,
        gap: perf.gap,
        pct: perf.pct,
      });
    }
  }
  rows.sort((a, b) => b.mKey.localeCompare(a.mKey) || a.agentName.localeCompare(b.agentName));
  return rows;
}

// ---------- Notation : fréquentation & client mystère (par point de vente) ----------

export function getOutletMetricEntry(s, kind, outletId, mKey, createIfMissing = false) {
  const bucket = s.ratings[kind];
  if (!bucket[outletId]) {
    if (!createIfMissing) return null;
    bucket[outletId] = {};
  }
  if (!bucket[outletId][mKey]) {
    if (!createIfMissing) return null;
    bucket[outletId][mKey] = { objective: 0, realized: 0, comment: '' };
  }
  return bucket[outletId][mKey];
}

export function upsertOutletMetric(s, kind, outletId, mKey, { objective, realized, comment }) {
  const e = getOutletMetricEntry(s, kind, outletId, mKey, true);
  e.objective = Number(objective) || 0;
  e.realized = Number(realized) || 0;
  e.comment = comment || '';
}

export function removeOutletMetricEntry(s, kind, outletId, mKey) {
  if (s.ratings[kind][outletId]) delete s.ratings[kind][outletId][mKey];
}

export function listOutletMetricRows(s, kind, filters = {}) {
  const { outletId = 'ALL', year = 'ALL' } = filters;
  const rows = [];
  for (const oId of Object.keys(s.ratings[kind])) {
    if (outletId !== 'ALL' && oId !== outletId) continue;
    const outlet = s.outlets.find((o) => o.id === oId);
    for (const mKey of Object.keys(s.ratings[kind][oId])) {
      const { year: y, monthIndex0 } = parseMonthKey(mKey);
      if (year !== 'ALL' && y !== Number(year)) continue;
      const entry = s.ratings[kind][oId][mKey];
      const gap = entry.realized - entry.objective;
      const pct = entry.objective > 0 ? entry.realized / entry.objective : null;
      rows.push({
        outletId: oId,
        outletName: outlet ? outlet.name : '(point de vente supprimé)',
        mKey, year: y, monthIndex0,
        objective: entry.objective,
        realized: entry.realized,
        gap, pct,
        comment: entry.comment || '',
      });
    }
  }
  rows.sort((a, b) => b.mKey.localeCompare(a.mKey) || a.outletName.localeCompare(b.outletName));
  return rows;
}

export { DEFAULT_PRODUCTS };
