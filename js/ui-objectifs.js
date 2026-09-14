import { MONTH_NAMES_FR, monthKey, fmtNum, fmtPct, pctClass, escapeHtml } from './utils.js';
import { upsertObjective, removeObjectiveEntry, listObjectiveRows } from './store.js';
import { openModal, closeModal } from './modal.js';

let ui = {
  subTab: 'suivi', // 'suivi' | 'historique'
  year: null,
  month: new Date().getMonth(),
  agentId: 'ALL',
  histAgentId: 'ALL',
  histYear: 'ALL',
};

export function renderObjectifs(root, state, actions) {
  if (ui.year === null) ui.year = state.meta.year;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="page-head-row">
      <div>
        <h1 class="page-title">Objectifs</h1>
        <p class="page-sub">Fixez l'objectif d'un vendeur et suivez sa progression.</p>
      </div>
      <button class="btn btn-primary" id="btnNewObjective">+ Nouvel objectif</button>
    </div>

    <div class="subtabs">
      <button class="subtab-btn ${ui.subTab === 'suivi' ? 'active' : ''}" data-subtab="suivi">Suivi du mois</button>
      <button class="subtab-btn ${ui.subTab === 'historique' ? 'active' : ''}" data-subtab="historique">Historique des objectifs</button>
    </div>

    <div id="subtabHost"></div>
  `;
  root.appendChild(wrap);

  if (!state.agents.length) {
    wrap.querySelector('#subtabHost').innerHTML = `<div class="empty-state">Ajoutez d'abord un vendeur dans l'onglet « Équipe &amp; Points de vente ».</div>`;
    wrap.querySelector('#btnNewObjective').disabled = true;
    return;
  }

  wrap.querySelector('#btnNewObjective').addEventListener('click', () => openObjectiveForm(state, actions, null));
  wrap.querySelectorAll('.subtab-btn').forEach((b) => {
    b.addEventListener('click', () => { ui.subTab = b.dataset.subtab; actions.rerender(); });
  });

  const host = wrap.querySelector('#subtabHost');
  if (ui.subTab === 'historique') renderHistorique(host, state, actions);
  else renderSuivi(host, state, actions);
}

// ---------- Sous-onglet : Suivi du mois ----------

function renderSuivi(host, state, actions) {
  host.innerHTML = `
    <div class="toolbar">
      <label class="field">Année
        <select id="fYear"></select>
      </label>
      <label class="field">Mois
        <select id="fMonth"></select>
      </label>
      <label class="field">Vendeur
        <select id="fAgent"><option value="ALL">Tous</option></select>
      </label>
    </div>
    <div id="tableHost"></div>
  `;

  const yearSel = host.querySelector('#fYear');
  [state.meta.year, ui.year, new Date().getFullYear()]
    .filter((v, i, a) => a.indexOf(v) === i).sort()
    .forEach((y) => addOption(yearSel, y, y, y === ui.year));

  const monthSel = host.querySelector('#fMonth');
  MONTH_NAMES_FR.forEach((m, i) => addOption(monthSel, i, m, i === ui.month));

  const agentSel = host.querySelector('#fAgent');
  state.agents.forEach((a) => addOption(agentSel, a.id, a.name, a.id === ui.agentId));

  yearSel.addEventListener('change', (e) => { ui.year = Number(e.target.value); actions.rerender(); });
  monthSel.addEventListener('change', (e) => { ui.month = Number(e.target.value); actions.rerender(); });
  agentSel.addEventListener('change', (e) => { ui.agentId = e.target.value; actions.rerender(); });

  const mKey = monthKey(ui.year, ui.month);
  const rows = listObjectiveRows(state, { agentId: ui.agentId, year: ui.year }).filter((r) => r.mKey === mKey);

  renderTable(host.querySelector('#tableHost'), rows, state, actions, { showActions: true, emptyText: 'Aucun objectif fixé pour ce mois. Cliquez sur « + Nouvel objectif » pour en créer un.' });
}

// ---------- Sous-onglet : Historique des objectifs ----------

function renderHistorique(host, state, actions) {
  host.innerHTML = `
    <p class="page-sub" style="margin-top:-4px">Retrace tous les objectifs assignés à chaque vendeur, tous mois confondus.</p>
    <div class="toolbar">
      <label class="field">Vendeur
        <select id="hAgent"><option value="ALL">Tous</option></select>
      </label>
      <label class="field">Année
        <select id="hYear"><option value="ALL">Toutes</option></select>
      </label>
    </div>
    <div id="tableHost"></div>
  `;

  const agentSel = host.querySelector('#hAgent');
  state.agents.forEach((a) => addOption(agentSel, a.id, a.name, a.id === ui.histAgentId));

  const years = new Set();
  Object.values(state.objectives).forEach((byProduct) => {
    Object.values(byProduct).forEach((byMonth) => {
      Object.keys(byMonth).forEach((mKey) => years.add(Number(mKey.slice(0, 4))));
    });
  });
  const yearSel = host.querySelector('#hYear');
  [...years].sort((a, b) => b - a).forEach((y) => addOption(yearSel, y, y, String(y) === String(ui.histYear)));

  agentSel.addEventListener('change', (e) => { ui.histAgentId = e.target.value; actions.rerender(); });
  yearSel.addEventListener('change', (e) => { ui.histYear = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value); actions.rerender(); });

  const rows = listObjectiveRows(state, { agentId: ui.histAgentId, year: ui.histYear });
  renderTable(host.querySelector('#tableHost'), rows, state, actions, { showActions: false, showPeriod: true, emptyText: 'Aucun objectif enregistré pour ces filtres.' });
}

// ---------- Tableau partagé ----------

function renderTable(host, rows, state, actions, { showActions, showPeriod, emptyText }) {
  if (!rows.length) {
    host.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  const box = document.createElement('div');
  box.className = 'table-wrap';
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Vendeur</th>
        <th>Produit</th>
        ${showPeriod ? '<th>Période</th>' : ''}
        <th>Objectif</th>
        <th>Sem.1</th><th>Sem.2</th><th>Sem.3</th><th>Sem.4</th>
        <th>Réalisé</th>
        <th>GAP</th>
        <th>%</th>
        <th>Commentaire</th>
        ${showActions ? '<th></th>' : ''}
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  rows.forEach((r) => {
    const cls = pctClass(r.pct);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge-agent">${escapeHtml(r.agentName)}</span></td>
      <td>${escapeHtml(r.productName)}${r.autoFromRegistry ? ' <span class="small muted">(auto)</span>' : ''}</td>
      ${showPeriod ? `<td>${MONTH_NAMES_FR[r.monthIndex0]} ${r.year}</td>` : ''}
      <td class="right">${fmtNum(r.objective)}</td>
      <td class="right">${fmtNum(r.weeks[0])}</td>
      <td class="right">${fmtNum(r.weeks[1])}</td>
      <td class="right">${fmtNum(r.weeks[2])}</td>
      <td class="right">${fmtNum(r.weeks[3])}</td>
      <td class="right"><b>${fmtNum(r.realized)}</b></td>
      <td class="right">${r.gap >= 0 ? '+' : ''}${fmtNum(r.gap)}</td>
      <td><span class="pill ${cls}">${fmtPct(r.pct)}</span></td>
      <td class="muted">${escapeHtml(r.comment) || '—'}</td>
      ${showActions ? `
        <td>
          <button class="btn btn-sm" data-edit="${r.agentId}|${r.productId}|${r.mKey}">Modifier</button>
          <button class="btn btn-sm btn-danger" data-del="${r.agentId}|${r.productId}|${r.mKey}">Suppr.</button>
        </td>
      ` : ''}
    `;
    tbody.appendChild(tr);
  });

  if (showActions) {
    table.addEventListener('click', (e) => {
      const editKey = e.target.dataset.edit;
      const delKey = e.target.dataset.del;
      if (editKey) {
        const [agentId, productId, mKey] = editKey.split('|');
        const row = rows.find((r) => r.agentId === agentId && r.productId === productId && r.mKey === mKey);
        openObjectiveForm(state, actions, row);
      } else if (delKey) {
        const [agentId, productId, mKey] = delKey.split('|');
        if (confirm('Supprimer cet objectif ?')) {
          actions.commit((s) => removeObjectiveEntry(s, agentId, productId, mKey));
        }
      }
    });
  }

  box.appendChild(table);
  host.innerHTML = '';
  host.appendChild(box);
}

// ---------- Formulaire modal "+ Nouvel objectif" ----------

function openObjectiveForm(state, actions, existingRow) {
  const isEdit = !!existingRow;
  const years = [state.meta.year, new Date().getFullYear(), new Date().getFullYear() + 1].filter((v, i, a) => a.indexOf(v) === i).sort();

  const agentId = isEdit ? existingRow.agentId : (state.agents[0] && state.agents[0].id);
  const productId = isEdit ? existingRow.productId : state.products[0].id;
  const year = isEdit ? existingRow.year : ui.year;
  const monthIndex0 = isEdit ? existingRow.monthIndex0 : ui.month;
  const objective = isEdit ? existingRow.objective : 0;
  const weeks = isEdit ? existingRow.weeks : [0, 0, 0, 0];
  const comment = isEdit ? existingRow.comment : '';
  const product = state.products.find((p) => p.id === productId);

  const agentField = isEdit
    ? `<div class="obj-locked">${escapeHtml(existingRow.agentName)}</div><input type="hidden" name="agentId" value="${agentId}">`
    : `<select name="agentId">${state.agents.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('')}</select>`;

  const productField = isEdit
    ? `<div class="obj-locked">${escapeHtml(existingRow.productName)}</div><input type="hidden" name="productId" value="${productId}">`
    : `<select name="productId" id="fp_product">${state.products.map((p) => `<option value="${p.id}" data-auto="${p.autoFromRegistry ? '1' : '0'}">${escapeHtml(p.name)}</option>`).join('')}</select>`;

  const yearField = isEdit
    ? `<div class="obj-locked">${year}</div><input type="hidden" name="year" value="${year}">`
    : `<select name="year">${years.map((y) => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('')}</select>`;

  const monthField = isEdit
    ? `<div class="obj-locked">${MONTH_NAMES_FR[monthIndex0]}</div><input type="hidden" name="monthIndex0" value="${monthIndex0}">`
    : `<select name="monthIndex0">${MONTH_NAMES_FR.map((m, i) => `<option value="${i}" ${i === monthIndex0 ? 'selected' : ''}>${m}</option>`).join('')}</select>`;

  const isAuto = product && product.autoFromRegistry;

  openModal(`
    <h2>${isEdit ? 'Modifier l’objectif' : 'Nouvel objectif'}</h2>
    <form id="objForm">
      <div class="form-grid">
        <label class="field">Vendeur${agentField}</label>
        <label class="field">Produit${productField}</label>
        <label class="field">Année${yearField}</label>
        <label class="field">Mois${monthField}</label>
        <label class="field full">Objectif du mois
          <input type="number" min="0" name="objective" value="${objective}" required>
        </label>
        <div class="full obj-weeks-row" id="fp_weeks">
          ${weeks.map((w, i) => `
            <div class="obj-week-field">
              <label>Semaine ${i + 1}</label>
              <input type="number" min="0" name="week${i}" value="${w}" ${isAuto ? 'disabled' : ''}>
            </div>
          `).join('')}
        </div>
        <p class="small muted full" id="fp_autoNote" ${isAuto ? '' : 'hidden'}>Ce produit est calculé automatiquement depuis le registre des abonnements 4G Home : les semaines ne sont pas modifiables ici.</p>
        <label class="field full">Commentaire
          <textarea name="comment" rows="2" placeholder="Observation, justification d'écart...">${escapeHtml(comment)}</textarea>
        </label>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" id="btnCancel">Annuler</button>
        <button type="submit" class="btn btn-primary">Valider l'objectif</button>
      </div>
    </form>
  `, (modalEl) => {
    modalEl.querySelector('#btnCancel').addEventListener('click', closeModal);

    const productSel = modalEl.querySelector('#fp_product');
    if (productSel) {
      productSel.addEventListener('change', () => {
        const auto = productSel.selectedOptions[0].dataset.auto === '1';
        modalEl.querySelectorAll('#fp_weeks input').forEach((inp) => { inp.disabled = auto; });
        modalEl.querySelector('#fp_autoNote').hidden = !auto;
      });
    }

    modalEl.querySelector('#objForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const fAgentId = fd.get('agentId');
      const fProductId = fd.get('productId');
      const fYear = Number(fd.get('year'));
      const fMonthIndex0 = Number(fd.get('monthIndex0'));
      const fMKey = monthKey(fYear, fMonthIndex0);
      const fWeeks = [fd.get('week0') || 0, fd.get('week1') || 0, fd.get('week2') || 0, fd.get('week3') || 0];
      const fComment = fd.get('comment') || '';
      const fObjective = fd.get('objective');

      actions.commit((s) => upsertObjective(s, fAgentId, fProductId, fMKey, { objective: fObjective, weeks: fWeeks, comment: fComment }));
      ui.subTab = 'suivi';
      ui.year = fYear;
      ui.month = fMonthIndex0;
      closeModal();
    });
  });
}

function addOption(select, value, label, selected) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  if (selected) o.selected = true;
  select.appendChild(o);
}
