import { MONTH_NAMES_FR, monthKey, fmtNum, fmtPct, pctClass, escapeHtml } from './utils.js';
import { computeProductMonth, getObjectiveEntry, setObjective, setWeekActual, setComment } from './store.js';

let ui = { year: null, month: new Date().getMonth(), agentId: null };

export function renderObjectifs(root, state, actions) {
  if (ui.year === null) ui.year = state.meta.year;
  if (ui.agentId === null && state.agents.length) ui.agentId = state.agents[0].id;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h1 class="page-title">Fiche d'objectifs mensuels</h1>
    <p class="page-sub">Un formulaire complet par produit : objectif du mois, ventes de chaque semaine et commentaire — pour fixer et suivre l'objectif d'un vendeur.</p>

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
    <div id="formBanner"></div>
    <div id="formHost" class="obj-form-grid"></div>
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
  const currentAgent = state.agents.find((a) => a.id === ui.agentId);

  wrap.querySelector('#formBanner').innerHTML = `
    <div class="obj-banner">
      Fiche d'objectifs de <b>${escapeHtml(currentAgent ? currentAgent.name : '')}</b>
      pour <b>${MONTH_NAMES_FR[ui.month]} ${ui.year}</b>
    </div>
  `;

  const host = wrap.querySelector('#formHost');

  state.products.forEach((p) => {
    host.appendChild(buildProductForm(state, actions, p, mKey));
  });

  host.addEventListener('change', (e) => {
    const productId = e.target.dataset.product;
    if (!productId) return;
    if (e.target.classList.contains('obj-input')) {
      actions.commit((s) => setObjective(s, ui.agentId, productId, mKey, e.target.value));
    } else if (e.target.classList.contains('week-input')) {
      const w = Number(e.target.dataset.week);
      actions.commit((s) => setWeekActual(s, ui.agentId, productId, mKey, w, e.target.value));
    } else if (e.target.classList.contains('comment-input')) {
      actions.commit((s) => setComment(s, ui.agentId, productId, mKey, e.target.value));
    }
  });
}

function buildProductForm(state, actions, product, mKey) {
  const r = computeProductMonth(state, ui.agentId, product.id, mKey);
  const entry = getObjectiveEntry(state, ui.agentId, product.id, mKey, false);
  const comment = entry ? (entry.comment || '') : '';
  const cls = pctClass(r.pct);
  const width = r.pct === null ? 0 : Math.min(100, Math.round(r.pct * 100));

  const card = document.createElement('div');
  card.className = 'obj-card';

  const weeksHtml = product.autoFromRegistry
    ? r.weeks.map((w, i) => `
        <div class="obj-week-field">
          <label>Semaine ${i + 1}</label>
          <div class="obj-week-readonly">${fmtNum(w)}</div>
        </div>
      `).join('')
    : r.weeks.map((w, i) => `
        <div class="obj-week-field">
          <label>Semaine ${i + 1}</label>
          <input type="number" min="0" class="week-input" value="${w}" data-product="${product.id}" data-week="${i}">
        </div>
      `).join('');

  card.innerHTML = `
    <div class="obj-card-head">
      <div>
        <div class="obj-card-title">${product.name}</div>
        ${product.autoFromRegistry ? '<span class="pill neutral">Calculé depuis le registre</span>' : `<span class="muted small">Unité : ${product.unit}</span>`}
      </div>
      <span class="pill ${cls}">${fmtPct(r.pct)}</span>
    </div>

    <div class="obj-field-obj">
      <label>Objectif du mois</label>
      <input type="number" min="0" class="obj-input" value="${r.objective}" data-product="${product.id}">
    </div>

    <div class="obj-weeks-row">${weeksHtml}</div>

    <div class="bar-track"><div class="bar-fill ${cls}" style="width:${width}%"></div></div>

    <div class="obj-card-foot">
      <span>Réalisé <b>${fmtNum(r.realized)}</b></span>
      <span>GAP <b>${r.gap >= 0 ? '+' : ''}${fmtNum(r.gap)}</b></span>
    </div>

    <label class="obj-comment-field">
      Commentaire
      <textarea class="comment-input" rows="2" placeholder="Observation, justification d'écart..." data-product="${product.id}">${escapeHtml(comment)}</textarea>
    </label>
  `;
  return card;
}
