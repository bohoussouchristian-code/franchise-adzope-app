import { MONTH_NAMES_FR, monthKey, fmtNum, fmtPct, fmtMoney, pctClass } from './utils.js';
import { computeProductPeriod } from './store.js';

let ui = { year: null, periodType: 'quarter', month: new Date().getMonth(), quarter: Math.floor(new Date().getMonth() / 3) + 1, agentId: 'ALL' };

export function renderBilan(root, state, actions) {
  if (ui.year === null) ui.year = state.meta.year;

  const wrap = document.createElement('div');

  wrap.innerHTML = `
    <h1 class="page-title">Bilan des activités</h1>
    <p class="page-sub">Objectifs vs réalisations, par produit</p>

    <div class="toolbar">
      <label class="field">Année
        <select id="fYear"></select>
      </label>
      <label class="field">Période
        <select id="fPeriodType">
          <option value="month">Mois</option>
          <option value="quarter">Trimestre</option>
          <option value="year">Année entière</option>
        </select>
      </label>
      <label class="field" id="fMonthWrap">Mois
        <select id="fMonth"></select>
      </label>
      <label class="field" id="fQuarterWrap">Trimestre
        <select id="fQuarter">
          <option value="1">T1 (Jan-Fév-Mars)</option>
          <option value="2">T2 (Avr-Mai-Juin)</option>
          <option value="3">T3 (Juil-Août-Sept)</option>
          <option value="4">T4 (Oct-Nov-Déc)</option>
        </select>
      </label>
      <label class="field">Vendeur
        <select id="fAgent">
          <option value="ALL">Équipe (tous)</option>
        </select>
      </label>
    </div>

    <div id="cards" class="grid-cards"></div>

    <div class="section">
      <h3 class="section-title">Aperçu abonnements 4G Home (registre)</h3>
      <div id="regSummary" class="grid-cards"></div>
    </div>
  `;
  root.appendChild(wrap);

  const yearSel = wrap.querySelector('#fYear');
  const years = new Set([state.meta.year, ui.year, new Date().getFullYear()]);
  [...years].sort().forEach((y) => {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    if (y === ui.year) o.selected = true;
    yearSel.appendChild(o);
  });

  const monthSel = wrap.querySelector('#fMonth');
  MONTH_NAMES_FR.forEach((m, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = m;
    if (i === ui.month) o.selected = true;
    monthSel.appendChild(o);
  });

  const agentSel = wrap.querySelector('#fAgent');
  state.agents.forEach((a) => {
    const o = document.createElement('option');
    o.value = a.id; o.textContent = a.name;
    if (a.id === ui.agentId) o.selected = true;
    agentSel.appendChild(o);
  });

  wrap.querySelector('#fPeriodType').value = ui.periodType;
  wrap.querySelector('#fQuarter').value = ui.quarter;

  wrap.querySelector('#fYear').addEventListener('change', (e) => { ui.year = Number(e.target.value); actions.rerender(); });
  wrap.querySelector('#fPeriodType').addEventListener('change', (e) => { ui.periodType = e.target.value; actions.rerender(); });
  wrap.querySelector('#fMonth').addEventListener('change', (e) => { ui.month = Number(e.target.value); actions.rerender(); });
  wrap.querySelector('#fQuarter').addEventListener('change', (e) => { ui.quarter = Number(e.target.value); actions.rerender(); });
  wrap.querySelector('#fAgent').addEventListener('change', (e) => { ui.agentId = e.target.value; actions.rerender(); });

  wrap.querySelector('#fMonthWrap').style.display = ui.periodType === 'month' ? '' : 'none';
  wrap.querySelector('#fQuarterWrap').style.display = ui.periodType === 'quarter' ? '' : 'none';

  const period = ui.periodType === 'month'
    ? { type: 'month', year: ui.year, monthIndex0: ui.month }
    : ui.periodType === 'quarter'
      ? { type: 'quarter', year: ui.year, quarter: ui.quarter }
      : { type: 'year', year: ui.year };

  const cards = wrap.querySelector('#cards');
  state.products.forEach((p) => {
    const r = computeProductPeriod(state, ui.agentId, p.id, period);
    cards.appendChild(buildCard(p.name, r));
  });

  // Résumé registre abonnements
  const monthKeys = periodMonthKeys(period);
  const subs = state.subscriptions4gHome.filter((s) => s.dateCreation && monthKeys.includes(s.dateCreation.slice(0, 7))
    && (ui.agentId === 'ALL' || s.agentId === ui.agentId));
  const tdd = subs.filter((s) => s.type === 'TDD').length;
  const fdd = subs.filter((s) => s.type === 'FDD').length;
  const revenue = subs.reduce((sum, s) => sum + (s.coutFactureInitiale || 0), 0);

  const regSummary = wrap.querySelector('#regSummary');
  regSummary.appendChild(miniStat('Total abonnements', fmtNum(subs.length)));
  regSummary.appendChild(miniStat('TDD (Flybox)', fmtNum(tdd)));
  regSummary.appendChild(miniStat('FDD (Easybox)', fmtNum(fdd)));
  regSummary.appendChild(miniStat('Facturation cumulée', fmtMoney(revenue)));
}

function periodMonthKeys(period) {
  if (period.type === 'month') return [monthKey(period.year, period.monthIndex0)];
  if (period.type === 'quarter') {
    const start = (period.quarter - 1) * 3;
    return [start, start + 1, start + 2].map((mi) => monthKey(period.year, mi));
  }
  return Array.from({ length: 12 }, (_, i) => monthKey(period.year, i));
}

function buildCard(name, r) {
  const el = document.createElement('div');
  el.className = 'stat-card';
  const cls = pctClass(r.pct);
  const width = r.pct === null ? 0 : Math.min(100, Math.round(r.pct * 100));
  el.innerHTML = `
    <div class="name">${name}</div>
    <div class="nums">
      <span>Objectif <b>${fmtNum(r.objective)}</b></span>
      <span>Réalisé <b>${fmtNum(r.realized)}</b></span>
    </div>
    <div class="bar-track"><div class="bar-fill ${cls}" style="width:${width}%"></div></div>
    <div class="nums">
      <span>GAP <b>${r.gap >= 0 ? '+' : ''}${fmtNum(r.gap)}</b></span>
      <span class="pill ${cls}">${fmtPct(r.pct)}</span>
    </div>
  `;
  return el;
}

function miniStat(label, value) {
  const el = document.createElement('div');
  el.className = 'stat-card';
  el.innerHTML = `<div class="name">${label}</div><div class="nums"><b style="font-size:20px">${value}</b></div>`;
  return el;
}
