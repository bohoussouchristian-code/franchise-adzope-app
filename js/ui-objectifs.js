import { MONTH_NAMES_FR, monthKey, fmtNum, fmtPct, pctClass } from './utils.js';
import { computeProductMonth, setObjective, setWeekActual } from './store.js';

let ui = { year: null, month: new Date().getMonth(), agentId: null };

export function renderObjectifs(root, state, actions) {
  if (ui.year === null) ui.year = state.meta.year;
  if (ui.agentId === null && state.agents.length) ui.agentId = state.agents[0].id;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h1 class="page-title">Objectifs mensuels</h1>
    <p class="page-sub">Saisissez l'objectif du mois et les ventes réalisées par semaine, pour chaque produit.</p>

    <div class="toolbar">
      <label class="field">Année
        <select id="fYear"></select>
      </label>
      <label class="field">Mois
        <select id="fMonth"></select>
      </label>
      <label class="field">Vendeur
        <select id="fAgent"></select>
      </label>
    </div>

    ${state.agents.length === 0 ? `<div class="empty-state">Ajoutez d'abord un vendeur dans l'onglet « Équipe &amp; Points de vente ».</div>` : ''}
    <div id="tableHost"></div>
  `;
  root.appendChild(wrap);

  if (!state.agents.length) return;

  const yearSel = wrap.querySelector('#fYear');
  [state.meta.year, ui.year, new Date().getFullYear()]
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort()
    .forEach((y) => {
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

  yearSel.addEventListener('change', (e) => { ui.year = Number(e.target.value); actions.rerender(); });
  monthSel.addEventListener('change', (e) => { ui.month = Number(e.target.value); actions.rerender(); });
  agentSel.addEventListener('change', (e) => { ui.agentId = e.target.value; actions.rerender(); });

  const mKey = monthKey(ui.year, ui.month);
  const host = wrap.querySelector('#tableHost');
  host.appendChild(buildTable(state, actions, mKey));
}

function buildTable(state, actions, mKey) {
  const box = document.createElement('div');
  box.className = 'table-wrap';
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Produit</th>
        <th>Objectif / mois</th>
        <th>Semaine 1</th>
        <th>Semaine 2</th>
        <th>Semaine 3</th>
        <th>Semaine 4</th>
        <th>Total réalisé</th>
        <th>GAP</th>
        <th>%</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  state.products.forEach((p) => {
    const r = computeProductMonth(state, ui.agentId, p.id, mKey);
    const tr = document.createElement('tr');
    const cls = pctClass(r.pct);

    const objCell = `<input type="number" min="0" class="obj-input" value="${r.objective}" data-product="${p.id}">`;

    let weekCells;
    if (p.autoFromRegistry) {
      weekCells = r.weeks.map((w) => `<td class="right muted">${fmtNum(w)}</td>`).join('');
    } else {
      weekCells = r.weeks.map((w, i) => `<td><input type="number" min="0" class="week-input" value="${w}" data-product="${p.id}" data-week="${i}"></td>`).join('');
    }

    tr.innerHTML = `
      <td>${p.name}${p.autoFromRegistry ? ' <span class="small muted">(auto, registre)</span>' : ''}</td>
      <td>${objCell}</td>
      ${weekCells}
      <td class="right"><b>${fmtNum(r.realized)}</b></td>
      <td class="right">${r.gap >= 0 ? '+' : ''}${fmtNum(r.gap)}</td>
      <td><span class="pill ${cls}">${fmtPct(r.pct)}</span></td>
    `;
    tbody.appendChild(tr);
  });

  table.addEventListener('change', (e) => {
    const productId = e.target.dataset.product;
    if (!productId) return;
    if (e.target.classList.contains('obj-input')) {
      actions.commit((s) => setObjective(s, ui.agentId, productId, mKey, e.target.value));
    } else if (e.target.classList.contains('week-input')) {
      const w = Number(e.target.dataset.week);
      actions.commit((s) => setWeekActual(s, ui.agentId, productId, mKey, w, e.target.value));
    }
  });

  box.appendChild(table);
  return box;
}
